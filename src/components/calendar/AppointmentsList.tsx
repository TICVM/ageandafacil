"use client";

import React, { useMemo, useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  BookOpen,
  Filter,
  Plus,
  Trash2,
  Images,
  X,
} from "lucide-react";
import { Appointment, AppointmentStatus, PhotoLocation, SchoolClass } from "@/lib/scheduler/types";
import { formatDateForDisplay } from "@/lib/calendar/utils";

interface AppointmentsListProps {
  appointments: Appointment[];
  locations: PhotoLocation[];
  classes?: SchoolClass[];
  onOpenBooking: () => void;
  onUpdateStatus: (id: string, status: AppointmentStatus) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  /** Optional handler for the "Publicar" action (marks the session as PUBLICADO). */
  onPublish?: (id: string) => Promise<void>;
}

export function AppointmentsList({
  appointments,
  locations,
  classes = [],
  onOpenBooking,
  onUpdateStatus,
  onCancel,
  onDelete,
  onPublish,
}: AppointmentsListProps) {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [locationFilter, setLocationFilter] = useState<string>("ALL");
  const [classFilter, setClassFilter] = useState<string>("ALL");
  const [subjectFilter, setSubjectFilter] = useState<string>("ALL");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Resolve the location name for a card. Reservations created through other
  // screens (e.g. /reserva) may store only the photoLocationId (or no
  // locationName at all), so we always prefer the up-to-date name from the
  // "photo_locations" database and fall back to the stored name/identifier.
  const getLocationName = (apt: Appointment): string => {
    const byId = locations.find((l) => l.id === apt.photoLocationId)?.name;
    if (byId) return byId;
    if (apt.locationName && apt.locationName !== "Não informado") {
      return apt.locationName;
    }
    // Some bookings store the free-text location identifier instead.
    const alt = (apt as unknown as { locationIdentifier?: string | null })
      .locationIdentifier;
    if (alt) return alt;
    return "Local não informado";
  };

  // Resolve the class (turma) name for a card. Sessions created through other
  // screens store only the schoolClassId, so we resolve the up-to-date name
  // from the "school_classes" database first and fall back to the stored
  // className when it is present and not a placeholder.
  const getClassName = (apt: Appointment): string => {
    const byId = apt.schoolClassId
      ? classes.find((c) => c.id === apt.schoolClassId)?.name
      : undefined;
    if (byId) return byId;
    if (apt.className && apt.className !== "Turma" && apt.className !== "Não informada") {
      return apt.className;
    }
    return "Turma não informada";
  };

  // Opções de turma: todas as turmas cadastradas no banco (school_classes)
  // mais as turmas citadas nas sessões que porventura não estejam no cadastro.
  const classOptions = useMemo(() => {
    const map = new Map<string, string>(); // value -> label
    classes.forEach((c) => map.set(c.id, c.name));
    appointments.forEach((a) => {
      const name = a.className && a.className !== "Turma" && a.className !== "Não informada"
        ? a.className
        : null;
      if (a.schoolClassId && !map.has(a.schoolClassId)) {
        map.set(a.schoolClassId, name ?? a.schoolClassId);
      } else if (!a.schoolClassId && name) {
        map.set(`name:${name}`, name);
      }
    });
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((x, y) => x.label.localeCompare(y.label, "pt-BR"));
  }, [appointments, classes]);

  // Opções de disciplina: valores únicos presentes nas sessões.
  const subjectOptions = useMemo(() => {
    const set = new Set<string>();
    appointments.forEach((a) => {
      const s = (a.subject ?? "").trim();
      if (s) set.add(s);
    });
    return Array.from(set).sort((x, y) => x.localeCompare(y, "pt-BR"));
  }, [appointments]);

  const filtered = appointments.filter((a) => {
    if (statusFilter !== "ALL" && a.status !== statusFilter) return false;
    if (locationFilter !== "ALL" && a.photoLocationId !== locationFilter) return false;
    if (classFilter !== "ALL") {
      if (classFilter.startsWith("name:")) {
        if (getClassName(a) !== classFilter.slice(5)) return false;
      } else if (a.schoolClassId) {
        if (a.schoolClassId !== classFilter) return false;
      } else if (getClassName(a) !== classes.find((c) => c.id === classFilter)?.name) {
        return false;
      }
    }
    if (subjectFilter !== "ALL" && (a.subject ?? "").trim() !== subjectFilter) return false;
    return true;
  });

  const hasActiveFilters =
    statusFilter !== "ALL" ||
    locationFilter !== "ALL" ||
    classFilter !== "ALL" ||
    subjectFilter !== "ALL";

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
      case "PUBLICADO":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <Images className="w-3 h-3" /> Publicado
          </span>
        );
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800">
            <CheckCircle2 className="w-3 h-3" /> Concluído
          </span>
        );
      case "EDITAR":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
            <AlertCircle className="w-3 h-3" /> Editar
          </span>
        );
      case "APROVACAO":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
            <AlertCircle className="w-3 h-3" /> Em aprovação
          </span>
        );
      case "APROVADO":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800">
            <CheckCircle2 className="w-3 h-3" /> Aprovado
          </span>
        );
      case "RESCHEDULED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
            <Calendar className="w-3 h-3" /> Reagendado
          </span>
        );
      case "RE_SCHEDULE_REQUEST":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-800">
            <AlertCircle className="w-3 h-3" /> Pedido de reagendamento
          </span>
        );
      default: {
        const labels: Record<string, string> = {
          PENDING: "Pendente",
          CONFIRMED: "Confirmado",
          CANCELLED: "Cancelado",
          PUBLICADO: "Publicado",
          COMPLETED: "Concluído",
          RESCHEDULED: "Reagendado",
          RE_SCHEDULE_REQUEST: "Pedido de reagendamento",
        };
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
            {labels[status] ?? status}
          </span>
        );
      }
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
            <option value="PENDING">Pendentes</option>
            <option value="EDITAR">Editar</option>
            <option value="APROVACAO">Em aprovação</option>
            <option value="APROVADO">Aprovados</option>
            <option value="CONFIRMED">Confirmados</option>
            <option value="RESCHEDULED">Reagendados</option>
            <option value="RE_SCHEDULE_REQUEST">Pedidos de reagendamento</option>
            <option value="COMPLETED">Concluídos</option>
            <option value="PUBLICADO">Publicados</option>
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

          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="h-8 px-2.5 text-xs font-medium rounded-lg border border-border bg-background text-foreground max-w-[160px]"
          >
            <option value="ALL">Todas as Turmas</option>
            {classOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="h-8 px-2.5 text-xs font-medium rounded-lg border border-border bg-background text-foreground max-w-[160px]"
          >
            <option value="ALL">Todas as Disciplinas</option>
            {subjectOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter("ALL");
                setLocationFilter("ALL");
                setClassFilter("ALL");
                setSubjectFilter("ALL");
              }}
              className="h-8 px-2.5 text-xs font-semibold rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent flex items-center gap-1"
              title="Limpar todos os filtros"
            >
              <X className="w-3.5 h-3.5" /> Limpar
            </button>
          )}
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
                    {getClassName(apt)}
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
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                    <span className="line-clamp-1">{getLocationName(apt)}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="line-clamp-1">Resp: {apt.teacherName}</span>
                  </div>

                  {(() => {
                    const subject =
                      apt.subject ??
                      (apt as unknown as { subject?: string | null }).subject;
                    if (!subject) return null;
                    return (
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 shrink-0 text-teal-600" />
                        <span className="line-clamp-1">{subject}</span>
                      </div>
                    );
                  })()}
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
                      {/* Fluxo de produção fotográfica: Editar → Em aprovação →
                          Aprovado → Confirmado → Publicado. Cada avanço também
                          atualiza o status da publicação vinculada no Controle
                          de Publicações (associação automática). */}
                      {(apt.status === "PENDING" || apt.status === "EDITAR") && (
                        <button
                          onClick={() => onUpdateStatus(apt.id, "EDITAR")}
                          className="px-2.5 py-1 text-xs font-semibold rounded-md bg-orange-600 text-white hover:bg-orange-700"
                          title="Iniciar edição/produção de conteúdo"
                        >
                          Editar
                        </button>
                      )}
                      {apt.status === "EDITAR" && (
                        <button
                          onClick={() => onUpdateStatus(apt.id, "APROVACAO")}
                          className="px-2.5 py-1 text-xs font-semibold rounded-md bg-purple-600 text-white hover:bg-purple-700"
                          title="Enviar para aprovação"
                        >
                          Enviar p/ aprovação
                        </button>
                      )}
                      {apt.status === "APROVACAO" && (
                        <button
                          onClick={() => onUpdateStatus(apt.id, "APROVADO")}
                          className="px-2.5 py-1 text-xs font-semibold rounded-md bg-teal-600 text-white hover:bg-teal-700"
                          title="Aprovar a sessão"
                        >
                          Aprovar
                        </button>
                      )}
                      {(apt.status === "APROVADO" || apt.status === "APROVACAO" || apt.status === "PENDING" || apt.status === "EDITAR") && (
                        <button
                          onClick={() => onUpdateStatus(apt.id, "CONFIRMED")}
                          className="px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                          Confirmar
                        </button>
                      )}
                      {(apt.status === "CONFIRMED" || apt.status === "COMPLETED" || apt.status === "APROVADO") && (
                        <button
                          onClick={() =>
                            (onPublish ?? ((id: string) => onUpdateStatus(id, "PUBLICADO")))(
                              apt.id
                            )
                          }
                          className="px-2.5 py-1 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-1"
                          title="Marcar esta sessão como publicada"
                        >
                          <Images className="w-3.5 h-3.5" /> Publicar
                        </button>
                      )}
                      {apt.status !== "CANCELLED" && apt.status !== "PUBLICADO" && (
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
