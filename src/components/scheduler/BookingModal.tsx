"use client";

import React, { useEffect, useMemo, useState } from "react";
import { X, Menu, Camera, AlertCircle, Hash, BookOpen, Sparkles, Loader2, ShieldAlert, CalendarDays } from "lucide-react";
import { PhotoLocation, SchoolClass, SchoolSegment, Appointment, AvailableTimeSlot, ScheduleBlock, AppSettings } from "@/lib/scheduler/types";
import { SlotOption } from "@/lib/scheduler/hooks";
import { aiSessionBriefAssistant } from "@/ai/flows/ai-session-brief-assistant-flow";

/** Formata "YYYY-MM-DD" como 05/10/2026 sem depender de timezone. */
const formatDateBR = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
};

/** Data local "YYYY-MM-DD" (evita UTC do toISOString). */
const toLocalYMD = (dt: Date) => {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/** Mesma regra da página /reserva: data mínima = hoje + antecedência mínima. */
const getMinDateStr = (settings?: AppSettings | null) => {
  const min = new Date();
  min.setHours(0, 0, 0, 0);
  min.setDate(min.getDate() + (settings?.minAdvanceBookingDays ?? 1));
  return toLocalYMD(min);
};

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  locations: PhotoLocation[];
  classes: SchoolClass[];
  segments: SchoolSegment[];
  existingAppointments: Appointment[];
  /** Horários configuráveis do banco (available_time_slots) — mesmos dados da página /reserva. */
  timeSlots?: AvailableTimeSlot[];
  /** Bloqueios de agenda (schedule_blocks) — mesma regra da página /reserva. */
  scheduleBlocks?: ScheduleBlock[];
  /** Antecedência mínima etc. (app_settings/general) — mesma regra da página /reserva. */
  appSettings?: AppSettings | null;
  /** Professor autenticado (nome/uid) — mesmo preenchimento automático da /reserva. */
  currentUserName?: string;
  currentUserUid?: string;
  onBook: (data: Omit<Appointment, "id">) => Promise<string>;
}

export function BookingModal({
  isOpen,
  onClose,
  locations,
  classes,
  segments,
  existingAppointments,
  timeSlots = [],
  scheduleBlocks = [],
  appSettings = null,
  currentUserName,
  currentUserUid,
  onBook,
}: BookingModalProps) {
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || "");
  const [selectedLocationId, setSelectedLocationId] = useState(locations[0]?.id || "");

  // Keep the selected location in sync when the locations list is loaded
  // from Firestore (photo_locations) after the modal initial render.
  useEffect(() => {
    if (locations.length === 0) return;
    if (!locations.some((l) => l.id === selectedLocationId)) {
      setSelectedLocationId(locations[0].id);
    }
  }, [locations, selectedLocationId]);

  // Mesma lógica da página /reserva: ao trocar a turma, o local é filtrado
  // pela unidade do segmento e a seleção anterior é limpa se ficar inválida.
  const filteredLocations = useMemo(() => {
    if (!selectedClassId) return locations;
    const selClass = classes.find((c) => c.id === selectedClassId);
    const selSeg = segments.find((s) => s.id === selClass?.segmentId);
    return locations.filter((l) => {
      if (!selSeg?.unit) return true;
      if (!l.unit) return true;
      return l.unit.toLowerCase().trim() === selSeg.unit.toLowerCase().trim();
    });
  }, [locations, classes, segments, selectedClassId]);

  useEffect(() => {
    if (filteredLocations.length === 0) return;
    if (!filteredLocations.some((l) => l.id === selectedLocationId)) {
      setSelectedLocationId(filteredLocations[0].id);
    }
  }, [filteredLocations, selectedLocationId]);

  // Mesma regra da /reserva: data inicial = hoje + antecedência mínima.
  const [appointmentDate, setAppointmentDate] = useState(() =>
    getMinDateStr(appSettings)
  );
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [teacherName, setTeacherName] = useState(currentUserName || "Professor");
  const [locationIdentifier, setLocationIdentifier] = useState("");
  const [observations, setObservations] = useState("");
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sincroniza o nome do professor autenticado (como na /reserva).
  useEffect(() => {
    if (currentUserName) setTeacherName(currentUserName);
  }, [currentUserName]);

  // appSettings pode chegar do Firestore depois da abertura do modal;
  // ajusta a data inicial para a antecedência mínima (mesma regra da /reserva).
  const minDateStr = useMemo(() => getMinDateStr(appSettings), [appSettings]);
  useEffect(() => {
    if (!appointmentDate || appointmentDate < minDateStr) {
      setAppointmentDate(minDateStr);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minDateStr]);

  // Horários disponíveis: MESMA regra usada na página /reserva.
  // Os horários são lidos de `available_time_slots` (via timeSlots recebido
  // do pai) e filtrados por dia da semana, turma/segmento, antecedência,
  // agendamentos já existentes e bloqueios da agenda.
  const availableSlots = useMemo<SlotOption[]>(() => {
    if (!timeSlots || !appointmentDate || !selectedClassId) return [];

    const selectedDate = new Date(`${appointmentDate}T00:00:00`);
    const dayOfWeek = selectedDate.getDay().toString();

    // Mesma regra da /reserva:
    // hoje + dias de antecedência + horas de antecedência.
    const now = new Date();
    const minLimit = new Date(now);
    minLimit.setHours(0, 0, 0, 0);
    minLimit.setDate(
      minLimit.getDate() + (appSettings?.minAdvanceBookingDays ?? 1)
    );
    minLimit.setHours(appSettings?.minAdvanceBookingHours ?? 0, 0, 0, 0);

    const selectedClass = classes.find((c) => c.id === selectedClassId);
    const dateStr = appointmentDate;

    const timeToMin = (time: string) => {
      if (!time) return 0;
      const [hours, minutes] = time.split(":").map(Number);
      return hours * 60 + minutes;
    };

    return timeSlots
      .filter((slot) => {
        // 1. O horário precisa estar configurado para o dia escolhido.
        if (slot.dayOfWeek !== dayOfWeek) return false;

        // 2. A configuração pode ser específica da turma, do segmento
        //    ou geral, exatamente como na página /reserva.
        const targetMatches = slot.schoolClassId
          ? slot.schoolClassId === selectedClassId
          : slot.schoolSegmentId
            ? slot.schoolSegmentId === selectedClass?.segmentId
            : !slot.schoolClassId && !slot.schoolSegmentId;

        if (!targetMatches) return false;

        // 3. Respeita a antecedência mínima em dias + horas.
        const [hours, minutes] = slot.startTime.split(":").map(Number);
        const slotDateTime = new Date(selectedDate);
        slotDateTime.setHours(hours, minutes, 0, 0);

        if (slotDateTime < minLimit) return false;

        // 4. Não permite horário já ocupado por outro agendamento,
        //    exceto os que foram cancelados.
        const alreadyBooked = existingAppointments.some(
          (appointment) =>
            appointment.appointmentDate === dateStr &&
            appointment.startTime === slot.startTime &&
            appointment.status !== "CANCELLED"
        );

        if (alreadyBooked) return false;

        // 5. Não permite horários que cruzem um bloqueio da agenda.
        const slotStart = timeToMin(slot.startTime);
        const slotEnd =
          slotStart + (slot.durationMinutes || 60);

        const isBlocked = scheduleBlocks.some(
          (block) =>
            block.date === dateStr &&
            slotStart < timeToMin(block.endTime) &&
            slotEnd > timeToMin(block.startTime)
        );

        if (isBlocked) return false;

        return true;
      })
      .sort((a, b) =>
        (a.startTime || "").localeCompare(b.startTime || "")
      )
      .map((slot) => {
        const startMinutes = timeToMin(slot.startTime);
        const endMinutes =
          startMinutes + (slot.durationMinutes || 60);

        return {
          ...slot,
          endTime: `${Math.floor(endMinutes / 60)
            .toString()
            .padStart(2, "0")}:${(endMinutes % 60)
            .toString()
            .padStart(2, "0")}`,
        };
      });
  }, [
    timeSlots,
    appointmentDate,
    selectedClassId,
    classes,
    existingAppointments,
    scheduleBlocks,
    appSettings,
  ]);

  // Mantém a seleção de horário válida quando a data/turma muda.
  useEffect(() => {
    if (availableSlots.length === 0) {
      setSelectedSlotId("");
      return;
    }
    if (!availableSlots.some((s) => s.id === selectedSlotId)) {
      setSelectedSlotId(availableSlots[0].id);
    }
  }, [availableSlots, selectedSlotId]);

  if (!isOpen) return null;

  const currentClass = classes.find((c) => c.id === selectedClassId);
  const currentLocation = locations.find((l) => l.id === selectedLocationId);
  const selectedSlot = availableSlots.find((s) => s.id === selectedSlotId) ?? null;
  const requiresIdentifier = Boolean(currentLocation?.requiresIdentifier);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedClassId || !selectedLocationId || !appointmentDate || !selectedSlot) {
      setErrorMessage("Preencha turma, local, data e um horário disponível.");
      return;
    }
    if (appointmentDate < minDateStr) {
      setErrorMessage(
        `A data deve ter a antecedência mínima permitida (a partir de ${formatDateBR(minDateStr)}).`
      );
      return;
    }
    if (requiresIdentifier && !locationIdentifier.trim()) {
      setErrorMessage('Este local exige a "Identificação do Local" (ex.: Sala 10).');
      return;
    }
    if (!teacherName.trim()) {
      setErrorMessage("Informe o Professor / Responsável.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Campos gravados exatamente como na página /reserva (coleção
      // "appointments"): subject vem do slot, locationIdentifier do campo
      // específico do local, endTime calculado pela duração do slot.
      await onBook({
        schoolClassId: selectedClassId,
        className: currentClass?.name || "Turma",
        photoLocationId: selectedLocationId,
        locationName: currentLocation?.name || "Local",
        locationIdentifier: locationIdentifier.trim() || null,
        teacherId: currentUserUid || "teacher-1",
        teacherName,
        appointmentDate,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        subject: selectedSlot.subject || null,
        status: "PENDING",
        observations,
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || "Erro ao agendar sessão.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateAI = async () => {
    if (!observations || !selectedClassId || !selectedLocationId) {
      setErrorMessage("Preencha a turma, o local e um resumo inicial antes de usar a IA.");
      return;
    }
    setErrorMessage(null);
    const selClass = classes.find((c) => c.id === selectedClassId);
    const selSeg = segments.find((s) => s.id === selClass?.segmentId);
    const selLoc = locations.find((l) => l.id === selectedLocationId);
    setIsGeneratingAI(true);
    try {
      const result = await aiSessionBriefAssistant({
        briefNotes: observations,
        className: selClass?.name || "Não informada",
        segmentName: selSeg?.name || "Não informado",
        locationName: selLoc?.name || "Não informado",
      });
      setObservations(result.detailedBrief);
    } catch {
      setErrorMessage("Erro ao gerar resumo com IA.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4">
      <div className="w-full sm:max-w-xl h-[100dvh] sm:h-auto bg-card sm:border sm:border-border sm:rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
        {/* Cabeçalho fixo */}
        <div className="flex items-center justify-between px-4 sm:p-5 border-b border-border bg-muted/20 shrink-0 pt-[max(1rem,env(safe-area-inset-top))] sm:pt-5">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2 truncate">
              <Camera className="w-4 h-4 text-primary shrink-0" />
              Agendar Sessão Fotográfica
            </h3>
            <p className="hidden sm:block text-xs text-muted-foreground">
              Os mesmos campos da página de Reserva: turma, local, identificação, data, horário e resumo.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 p-4 sm:p-6 space-y-4 overflow-y-auto">
          {errorMessage && (
            <div className="p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-900 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Class & Location (mesmos campos da /reserva) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Turma *
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full h-11 sm:h-10 px-3 text-base sm:text-sm rounded-lg border border-border bg-background text-foreground appearance-none"
              >
                <option value="">Selecione a turma</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Local *
              </label>
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                disabled={!selectedClassId}
                className="w-full h-11 sm:h-10 px-3 text-base sm:text-sm rounded-lg border border-border bg-background text-foreground disabled:opacity-50 appearance-none"
              >
                <option value="">Escolha o local</option>
                {filteredLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                    {loc.unit ? ` (${loc.unit})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Identificação do Local — aparece quando o local exige (igual à /reserva) */}
          {requiresIdentifier && (
            <div className="animate-in fade-in slide-in-from-top-2">
              <label className="block text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-primary" />
                Identificação do Local (Ex: Sala 10, Lab B) *
              </label>
              <input
                type="text"
                required
                value={locationIdentifier}
                onChange={(e) => setLocationIdentifier(e.target.value)}
                placeholder="Especifique o número ou nome da sala..."
                className="w-full h-11 sm:h-10 px-3 text-base sm:text-sm rounded-lg border border-primary/30 bg-background text-foreground"
              />
            </div>
          )}

          {/* Identificação do Professor — mesmo campo de identificação da /reserva */}
          <div className="p-3 sm:p-4 rounded-xl border border-border bg-muted/30 space-y-3">
            <label className="block text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Menu className="w-3.5 h-3.5 text-primary" />
              Identificação do Professor
            </label>
            <input
              type="text"
              required
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              placeholder="Ex: Prof. Helena Ramos"
              className="w-full h-11 px-3 text-base sm:text-sm rounded-lg border border-border bg-background text-foreground"
            />
          </div>

          {/* Data — seletor nativo com a mesma antecedência mínima da /reserva */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Data *
            </label>
            <div className="relative">
              <input
                type="date"
                required
                min={minDateStr}
                value={appointmentDate}
                onChange={(e) => {
                  if (e.target.value) setAppointmentDate(e.target.value);
                }}
                className="w-full h-11 px-3 pr-10 text-base sm:text-sm rounded-lg border border-border bg-background text-foreground appearance-none"
              />
              <CalendarDays className="w-4 h-4 text-primary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Antecedência mínima: {appSettings?.minAdvanceBookingDays ?? 1}d{" "}
              {appSettings?.minAdvanceBookingHours ?? 0}h — a partir de {formatDateBR(minDateStr)}
            </p>
          </div>

          {/* Regras da Unidade — mesmos dados exibidos na /reserva */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 sm:p-4">
            <h4 className="font-bold text-[11px] uppercase tracking-widest text-primary flex items-center gap-1.5 mb-2">
              <ShieldAlert className="w-3.5 h-3.5" />
              Regras da Unidade
            </h4>
            <ul className="space-y-1 text-[11px] sm:text-xs text-muted-foreground list-disc list-inside">
              <li>Antecedência mínima: {appSettings?.minAdvanceBookingDays ?? 1}d {appSettings?.minAdvanceBookingHours ?? 0}h</li>
              <li>Verifique a disponibilidade do local escolhido.</li>
              <li>Comunique alterações com antecedência.</li>
            </ul>
          </div>

          {/* Time Slot Selection — layout preservado, agora com os horários
              reais do banco (available_time_slots), mesma regra da /reserva */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-2">
              Horários Disponíveis
            </label>
            {availableSlots.length === 0 ? (
              <div className="p-3 rounded-xl border border-dashed border-border bg-muted/40 text-xs text-muted-foreground flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Nenhum horário disponível para esta turma nesta data. Verifique a
                configuração de horários (Admin → Horários) e a antecedência mínima.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {availableSlots.map((slot) => {
                  const isSelected = selectedSlotId === slot.id;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => setSelectedSlotId(slot.id)}
                      className={`py-2.5 px-2.5 rounded-lg border text-sm sm:text-xs font-semibold transition-all flex flex-col items-center gap-0.5 ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground shadow-xs"
                          : "border-border bg-background text-foreground hover:bg-accent"
                      }`}
                    >
                      <span>{slot.startTime}</span>
                      <span className="text-[10px] font-normal opacity-80 line-clamp-1">
                        {slot.subject ? slot.subject : `${slot.durationMinutes} min`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {selectedSlot?.subject && (
              <p className="text-[11px] text-primary font-bold flex items-center gap-1.5 mt-2 animate-in slide-in-from-left-2">
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                Disciplina: {selectedSlot.subject}
              </p>
            )}
          </div>

          {/* Resumo da Atividade / Briefing (com o mesmo botão de IA da /reserva) */}
          <div>
            <div className="flex items-center justify-between mb-1 gap-2">
              <label className="block text-xs font-semibold text-foreground">
                Resumo da Atividade
              </label>
              <button
                type="button"
                onClick={handleGenerateAI}
                disabled={isGeneratingAI || !observations || !selectedClassId || !selectedLocationId}
                className="flex items-center gap-1.5 text-[11px] font-bold text-primary hover:bg-primary/10 rounded-md px-2 py-1 disabled:opacity-40 shrink-0"
              >
                {isGeneratingAI ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Aprimorar com IA
              </button>
            </div>
            <textarea
              rows={3}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Descreva brevemente o que os alunos estarão fazendo. Use a IA para expandir o texto para o marketing..."
              className="w-full p-3 text-sm sm:text-xs rounded-lg border border-border bg-background text-foreground resize-none"
            />
          </div>

          {/* Footer Buttons — largura total no mobile, com safe-area */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-4 border-t border-border pb-[max(0.5rem,env(safe-area-inset-bottom))] sticky bottom-0 bg-card">
            <button
              type="submit"
              disabled={
                isSubmitting ||
                !selectedClassId ||
                !selectedLocationId ||
                !selectedSlot ||
                appointmentDate < minDateStr ||
                (requiresIdentifier && !locationIdentifier.trim())
              }
              className="w-full sm:w-auto h-12 sm:h-11 px-5 rounded-xl text-sm sm:text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? "Agendando..." : "Confirmar Agendamento"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto h-11 px-4 rounded-xl text-sm sm:text-xs font-semibold text-muted-foreground hover:bg-accent"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
