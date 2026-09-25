"use client";

import React, { useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Filter,
  Plus,
  Trash2,
} from "lucide-react";
import { Appointment, AppointmentStatus, PhotoLocation } from "@/lib/scheduler/types";
import { formatDateForDisplay } from "@/lib/calendar/utils";

interface AppointmentsListProps {
  appointments: Appointment[];
  locations: PhotoLocation[];
  onOpenBooking: () => void;
  onUpdateStatus: (id: string, status: AppointmentStatus) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function AppointmentsList({
  appointments,
  locations,
  onOpenBooking,
  onUpdateStatus,
  onCancel,
  onDelete,
}: AppointmentsListProps) {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [locationFilter, setLocationFilter] = useState<string>("ALL");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filtered = appointments.filter((a) => {
    if (statusFilter !== "ALL" && a.status !== statusFilter) return false;
    if (locationFilter !== "ALL" && a.photoLocationId !== locationFilter) return false;
    return true;
  });

  const getStatusBadge = (status: AppointmentStatus) => {
    switch (status) {
      case "CONFIRMED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3 h-3" /> Confirmado
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <AlertCircle className="w-3 h-3" /> Pendente
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-200 text-zinc-700">
            <XCircle className="w-3 h-3" /> Cancelado
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
            {status}
          </span>
        );
    }
  };

  const handleConfirmDelete = (id: string) => {
    setDeletingId(null);
    onDelete(id).catch((err) => {
      console.error("Error deleting appointment:", err);
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filtrar:
          </span>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 px-2.5 text-xs font-medium rounded-lg border border-border bg-background text-foreground"
          >
            <option value="ALL">Todos os Status</option>
            <option value="CONFIRMED">Confirmados</option>
            <option value="PENDING">Pendentes</option>
            <option value="CANCELLED">Cancelados</option>
          </select>

          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="h-8 px-2.5 text-xs font-medium rounded-lg border border-border bg-background text-foreground"
          >
            <option value="ALL">Todos os Locais</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={onOpenBooking}
          className="px-4 py-2 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 shadow-xs shrink-0"
        >
          <Plus className="w-4 h-4" /> Agendar Nova Sessão
        </button>
      </div>

      {/* Grid of appointments */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
          <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30 stroke-1" />
          <p className="font-semibold text-foreground">Nenhuma sessão encontrada</p>
          <p className="text-xs mt-1">
            Altere os filtros acima ou crie um novo agendamento fotográfico.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((apt) => (
            <div
              key={apt.id}
              className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3 flex flex-col justify-between hover:border-primary/40 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="font-bold text-base text-foreground line-clamp-1">
                    {apt.className}
                  </span>
                  {getStatusBadge(apt.status)}
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    <span className="font-semibold text-foreground">
                      {formatDateForDisplay(apt.appointmentDate)}
                    </span>
                    <span className="text-muted-foreground/60">•</span>
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    <span>
                      {apt.startTime} - {apt.endTime}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-600" />
                    <span className="line-clamp-1">{apt.locationName}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="line-clamp-1">Resp: {apt.teacherName}</span>
                  </div>
                </div>

                {apt.observations && (
                  <p className="mt-3 p-2.5 rounded-lg bg-muted/40 text-[11px] text-muted-foreground italic border border-border/40 line-clamp-2">
                    &ldquo;{apt.observations}&rdquo;
                  </p>
                )}
              </div>

              {/* Action Buttons & Delete */}
              <div className="pt-3 border-t border-border/60">
                {deletingId === apt.id ? (
                  <div className="flex items-center justify-between gap-2 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 p-2 rounded-lg text-xs">
                    <span className="font-semibold text-rose-700 dark:text-rose-400">
                      Excluir sessão?
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        disabled={isDeleting}
                        onClick={() => handleConfirmDelete(apt.id)}
                        className="px-2.5 py-1 bg-rose-600 text-white font-bold rounded hover:bg-rose-700 transition-colors"
                      >
                        {isDeleting ? "..." : "Sim, Excluir"}
                      </button>
                      <button
                        disabled={isDeleting}
                        onClick={() => setDeletingId(null)}
                        className="px-2 py-1 bg-background border border-border text-foreground rounded font-medium hover:bg-accent"
                      >
                        Não
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => setDeletingId(apt.id)}
                      className="px-2 py-1 text-xs font-semibold rounded-md text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors flex items-center gap-1"
                      title="Excluir este agendamento"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Excluir
                    </button>

                    <div className="flex items-center gap-2">
                      {apt.status === "PENDING" && (
                        <button
                          onClick={() => onUpdateStatus(apt.id, "CONFIRMED")}
                          className="px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                          Confirmar
                        </button>
                      )}
                      {apt.status !== "CANCELLED" && (
                        <button
                          onClick={() => onCancel(apt.id)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
