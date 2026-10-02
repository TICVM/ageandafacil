"use client";

import React, { useEffect, useMemo, useState } from "react";
import { X, Camera, Clock, MapPin, Users, AlertCircle, CheckCircle2, Hash, BookOpen, Sparkles, Loader2 } from "lucide-react";
import { PhotoLocation, SchoolClass, SchoolSegment, Appointment, AvailableTimeSlot, ScheduleBlock, AppSettings } from "@/lib/scheduler/types";
import { getAvailableBookingSlots, SlotOption } from "@/lib/scheduler/hooks";
import { formatDateForDisplay } from "@/lib/calendar/utils";
import { aiSessionBriefAssistant } from "@/ai/flows/ai-session-brief-assistant-flow";

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

  const [appointmentDate, setAppointmentDate] = useState(
    new Date().toISOString().split("T")[0]
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

  // Horários disponíveis calculados com a MESMA regra da página /reserva:
  // dia da semana + turma/segmento + antecedência mínima + ocupações + bloqueios.
  const availableSlots = useMemo<SlotOption[]>(() => {
    if (!selectedClassId || !appointmentDate) return [];
    return getAvailableBookingSlots({
      configuredSlots: timeSlots,
      dateStr: appointmentDate,
      schoolClassId: selectedClassId,
      classes,
      appointments: existingAppointments,
      blocks: scheduleBlocks,
      settings: appSettings,
    });
  }, [timeSlots, appointmentDate, selectedClassId, classes, existingAppointments, scheduleBlocks, appSettings]);

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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-border bg-muted/20">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary" />
              Agendar Sessão Fotográfica Escolar
            </h3>
            <p className="text-xs text-muted-foreground">
              Os mesmos campos da página de Reserva: turma, local, identificação, data, horário e resumo.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
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
                className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-background text-foreground"
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
                className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-background text-foreground disabled:opacity-50"
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
                className="w-full h-10 px-3 text-sm rounded-lg border border-primary/30 bg-background text-foreground"
              />
            </div>
          )}

          {/* Date & Teacher */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Data *
              </label>
              <input
                type="date"
                required
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-background text-foreground"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Professor / Responsável *
              </label>
              <input
                type="text"
                required
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                placeholder="Ex: Prof. Helena Ramos"
                className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-background text-foreground"
              />
            </div>
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
                      className={`py-2 px-2.5 rounded-lg border text-xs font-semibold transition-all flex flex-col items-center gap-0.5 ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground shadow-xs"
                          : "border-border bg-background text-foreground hover:bg-accent"
                      }`}
                    >
                      <span>{slot.startTime}</span>
                      <span className="text-[10px] font-normal opacity-80">
                        {slot.subject ? slot.subject : `${slot.durationMinutes} min`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {selectedSlot?.subject && (
              <p className="text-[11px] text-primary font-bold flex items-center gap-1.5 mt-2 animate-in slide-in-from-left-2">
                <BookOpen className="w-3.5 h-3.5" />
                Disciplina: {selectedSlot.subject}
              </p>
            )}
          </div>

          {/* Resumo da Atividade / Briefing (com o mesmo botão de IA da /reserva) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-foreground">
                Resumo da Atividade
              </label>
              <button
                type="button"
                onClick={handleGenerateAI}
                disabled={isGeneratingAI || !observations || !selectedClassId || !selectedLocationId}
                className="flex items-center gap-1.5 text-[11px] font-bold text-primary hover:bg-primary/10 rounded-md px-2 py-1 disabled:opacity-40"
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
              className="w-full p-3 text-xs rounded-lg border border-border bg-background text-foreground resize-none"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-accent"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting ||
                !selectedClassId ||
                !selectedLocationId ||
                !selectedSlot ||
                (requiresIdentifier && !locationIdentifier.trim())
              }
              className="px-5 py-2 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? "Agendando..." : "Confirmar Agendamento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
