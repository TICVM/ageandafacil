"use client";

import React, { useState } from "react";
import { X, Camera, Clock, MapPin, Users, AlertCircle, CheckCircle2 } from "lucide-react";
import { PhotoLocation, SchoolClass, SchoolSegment, Appointment } from "@/lib/scheduler/types";
import { DEFAULT_TIME_SLOTS } from "@/lib/scheduler/constants";
import { formatDateForDisplay } from "@/lib/calendar/utils";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  locations: PhotoLocation[];
  classes: SchoolClass[];
  segments: SchoolSegment[];
  existingAppointments: Appointment[];
  onBook: (data: Omit<Appointment, "id">) => Promise<string>;
}

export function BookingModal({
  isOpen,
  onClose,
  locations,
  classes,
  segments,
  existingAppointments,
  onBook,
}: BookingModalProps) {
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || "");
  const [selectedLocationId, setSelectedLocationId] = useState(locations[0]?.id || "");
  const [appointmentDate, setAppointmentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [selectedSlot, setSelectedSlot] = useState(DEFAULT_TIME_SLOTS[0]);
  const [teacherName, setTeacherName] = useState("Prof. Marcos Andrade");
  const [observations, setObservations] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentClass = classes.find((c) => c.id === selectedClassId);
  const currentLocation = locations.find((l) => l.id === selectedLocationId);

  // Check if slot has conflict
  const isSlotBooked = (slot: { startTime: string; endTime: string }) => {
    return existingAppointments.some(
      (a) =>
        a.status !== "CANCELLED" &&
        a.appointmentDate === appointmentDate &&
        a.photoLocationId === selectedLocationId &&
        a.startTime === slot.startTime
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (isSlotBooked(selectedSlot)) {
      setErrorMessage("Este horário já está reservado para este local!");
      return;
    }

    setIsSubmitting(true);
    try {
      await onBook({
        schoolClassId: selectedClassId,
        className: currentClass?.name || "Turma",
        photoLocationId: selectedLocationId,
        locationName: currentLocation?.name || "Local",
        teacherId: "teacher-1",
        teacherName,
        appointmentDate,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        status: "CONFIRMED",
        observations,
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || "Erro ao agendar sessão.");
    } finally {
      setIsSubmitting(false);
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
              Selecione a turma, local e horário para a sessão de fotos.
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

          {/* Class & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Turma Escolar *
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-background text-foreground"
              >
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Local da Foto *
              </label>
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-background text-foreground"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date & Teacher */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Data do Agendamento *
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

          {/* Time Slot Selection */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-2">
              Horários Disponíveis (Sessões de 50 min)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {DEFAULT_TIME_SLOTS.map((slot, idx) => {
                const booked = isSlotBooked(slot);
                const isSelected =
                  selectedSlot.startTime === slot.startTime && !booked;

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={booked}
                    onClick={() => setSelectedSlot(slot)}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-semibold transition-all flex flex-col items-center gap-0.5 ${
                      booked
                        ? "border-dashed border-border bg-muted/40 text-muted-foreground/50 cursor-not-allowed line-through"
                        : isSelected
                        ? "border-primary bg-primary text-primary-foreground shadow-xs"
                        : "border-border bg-background text-foreground hover:bg-accent"
                    }`}
                  >
                    <span>{slot.startTime}</span>
                    <span className="text-[10px] font-normal opacity-80">
                      {booked ? "Ocupado" : "Disponível"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Observations */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Briefing / Observações da Sessão
            </label>
            <textarea
              rows={3}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Ex: Fotos individuais e em grupo com o material escolar de artes..."
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
              disabled={isSubmitting}
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
