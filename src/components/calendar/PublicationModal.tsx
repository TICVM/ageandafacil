"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Calendar,
  Clock,
  Trash2,
  Copy,
  AlertTriangle,
  History,
  Check,
  Tag,
  User,
} from "lucide-react";
import {
  Publication,
  Category,
  Series,
  Holiday,
  PublicationStatus,
  Priority,
} from "@/lib/calendar/types";
import { Appointment, SchoolClass } from "@/lib/scheduler/types";
import {
  DEFAULT_STATUSES,
  DEFAULT_PRIORITIES,
} from "@/lib/calendar/constants";
import {
  calculatePlannedDate,
  checkDateConflict,
  formatDateForDisplay,
} from "@/lib/calendar/utils";
import {
  resolveClassName,
  seriesFromClassName,
  isBilingualSubject,
  linkKey,
} from "@/lib/scheduler/association";
import {
  normalizeAppointmentStatus,
  mapPublicationStatusToAppointment,
} from "@/lib/scheduler/status-mapping";

interface PublicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  publication?: Publication | null;
  initialDate?: string;
  categories: Category[];
  series: Series[];
  holidays: Holiday[];
  allPublications: Publication[];
  /** Sessões fotográficas — permitem associar publicações do Controle de Publicações. */
  appointments?: Appointment[];
  classes?: SchoolClass[];
  onSave: (data: Omit<Publication, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  onUpdate: (id: string, data: Partial<Publication>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDuplicate: (id: string, newDate: string) => Promise<void>;
  /** Atualiza o status de uma sessão fotográfica (cascata ao salvar no modal). */
  onUpdateAppointmentStatus?: (appointmentId: string, status: Appointment["status"]) => Promise<void> | void;
  getDeadline: (catId: string, seriesId?: string) => number;
}

export function PublicationModal({
  isOpen,
  onClose,
  publication,
  initialDate,
  categories,
  series,
  holidays,
  allPublications,
  appointments,
  classes,
  onSave,
  onUpdate,
  onDelete,
  onDuplicate,
  onUpdateAppointmentStatus,
  getDeadline,
}: PublicationModalProps) {
  const isEditing = Boolean(publication);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("ATIVIDADES_VARIADAS");
  const [seriesId, setSeriesId] = useState<string>("MATERNAL");
  const [publicationDate, setPublicationDate] = useState("");
  const [productionDays, setProductionDays] = useState(7);
  const [status, setStatus] = useState<PublicationStatus>("PLANEJAMENTO");
  const [priority, setPriority] = useState<Priority>("MEDIA");
  const [responsibleName, setResponsibleName] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"details" | "history">("details");
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDuplicatePrompt, setShowDuplicatePrompt] = useState(false);
  const [duplicateDateInput, setDuplicateDateInput] = useState("");
  // Vínculo manual com sessões fotográficas (tags "apt:<id>") — permite
  // associar a publicação às linhas do Controle de Publicações.
  const [linkedAptIds, setLinkedAptIds] = useState<string[]>([]);

  // Sessões candidatas ao vínculo: as que correspondem à categoria/série
  // escolhidos no formulário (mesma regra da associação automática), mais as
  // já vinculadas a esta publicação — para poder removê-las também.
  const candidateAppointments: Appointment[] = (() => {
    const list = appointments ?? [];
    if (list.length === 0) return [];
    const cls = classes ?? [];
    const alreadyLinked = new Set(linkedAptIds);
    return list.filter((a) => {
      if (alreadyLinked.has(a.id)) return true;
      const st = normalizeAppointmentStatus(a.status as unknown as string);
      if (st === "CANCELLED") return false;
      const aptSeries = seriesFromClassName(resolveClassName(a, cls));
      if (!aptSeries || aptSeries !== seriesId) return false;
      const aptCategory = isBilingualSubject(a.subject)
        ? "PROGRAMA_BILINGUE"
        : "ATIVIDADES_VARIADAS";
      return aptCategory === categoryId;
    });
  })();

  const toggleLinkedApt = (aptId: string) => {
    setLinkedAptIds((prev) =>
      prev.includes(aptId) ? prev.filter((i) => i !== aptId) : [...prev, aptId]
    );
  };

  // Sync state with open/edit props
  useEffect(() => {
    setShowDeleteConfirm(false);
    setShowDuplicatePrompt(false);
    if (publication) {
      setTitle(publication.title || "");
      setDescription(publication.description || "");
      setCategoryId(publication.categoryId || "ATIVIDADES_VARIADAS");
      setSeriesId(publication.seriesId || "MATERNAL");
      setPublicationDate(publication.publicationDate || "");
      setDuplicateDateInput(publication.publicationDate || "");
      setProductionDays(publication.productionDays || 7);
      setStatus(publication.status || "PLANEJAMENTO");
      setPriority(publication.priority || "MEDIA");
      setResponsibleName(publication.responsibleName || "");
      setTags(publication.tags || []);
      setLinkedAptIds(
        (publication.tags ?? [])
          .filter((t) => t.startsWith("apt:"))
          .map((t) => t.slice(4))
      );
    } else {
      setTitle("");
      setDescription("");
      const initialCat = "ATIVIDADES_VARIADAS";
      const initialSer = "MATERNAL";
      setCategoryId(initialCat);
      setSeriesId(initialSer);
      const defaultDate = initialDate || new Date().toISOString().split("T")[0];
      setPublicationDate(defaultDate);
      setDuplicateDateInput(defaultDate);
      const initialDeadline = getDeadline(initialCat, initialSer);
      setProductionDays(initialDeadline);
      setStatus("PLANEJAMENTO");
      setPriority("MEDIA");
      setResponsibleName("");
      setTags([]);
      setLinkedAptIds([]);
    }
  }, [publication, initialDate, isOpen, getDeadline]);

  // Update production days when category or series changes in creation mode
  const handleCategoryOrSeriesChange = (newCat: string, newSer: string) => {
    setCategoryId(newCat);
    setSeriesId(newSer);
    if (!isEditing) {
      const calculatedDays = getDeadline(newCat, newSer);
      setProductionDays(calculatedDays);
    }
  };

  if (!isOpen) return null;

  // Calculated planned date
  const plannedDate = calculatePlannedDate(publicationDate, productionDays, holidays);

  // Conflict check
  const conflict = checkDateConflict(allPublications, {
    id: publication?.id,
    publicationDate,
  });

  const todayStr = new Date().toISOString().split("T")[0];
  const isPastPlanned = plannedDate && plannedDate < todayStr && status !== "PUBLICADO";

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput("");
    }
  };

  const handleRemoveTag = (t: string) => {
    setTags(tags.filter((item) => item !== t));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Publicações obrigatórias geradas podem ser salvas sem título
    if (!publicationDate) return;
    setIsSaving(true);

    try {
      // Monta as tags finais: remove vínculos "apt:" antigos e adiciona os
      // selecionados manualmente — é assim que a publicação fica associada às
      // linhas do Controle de Publicações / sessões fotográficas.
      const baseTags = tags.filter((t) => !t.startsWith("apt:"));
      const finalTags = [
        ...new Set([...baseTags, ...linkedAptIds.map((id) => linkKey(id))]),
      ];

      if (isEditing && publication) {
        await onUpdate(publication.id, {
          title,
          description,
          categoryId,
          seriesId,
          publicationDate,
          plannedDate,
          productionDays,
          status,
          priority,
          responsibleName,
          tags: finalTags,
        });

        // Cascata imediata: ao publicar/alterar o status aqui, as sessões
        // fotográficas vinculadas recebem o status equivalente — sem esperar
        // a sincronia automática.
        const nowLinked = finalTags.filter((t) => t.startsWith("apt:"));
        const targetApt = mapPublicationStatusToAppointment(status);
        for (const t of nowLinked) {
          const apt = (appointments ?? []).find((a) => a.id === t.slice(4));
          if (!apt) continue;
          const cur = normalizeAppointmentStatus(apt.status as unknown as string);
          if (cur === targetApt) continue;
          try {
            await onUpdateAppointmentStatus?.(apt.id, targetApt);
          } catch (err) {
            console.warn("Cascata modal→sessão falhou:", err);
          }
        }
      } else {
        await onSave({
          title,
          description,
          categoryId,
          seriesId,
          publicationDate,
          plannedDate,
          productionDays,
          status,
          priority,
          responsibleName,
          tags: finalTags,
        });
      }
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
    setShowDuplicatePrompt(false);
  };

  const handleConfirmDelete = () => {
    if (!publication) return;
    const pubId = publication.id;
    // Close modal instantly so the UI never feels stuck or frozen
    setShowDeleteConfirm(false);
    onClose();
    // Execute delete optimistically
    onDelete(pubId).catch((err) => {
      console.error("Error deleting publication:", err);
    });
  };

  const handleDuplicateClick = () => {
    setShowDuplicatePrompt(true);
    setShowDeleteConfirm(false);
  };

  const handleConfirmDuplicate = async () => {
    if (!publication || !duplicateDateInput) return;
    setIsSaving(true);
    try {
      await onDuplicate(publication.id, duplicateDateInput);
      setShowDuplicatePrompt(false);
      onClose();
    } catch (err) {
      console.error("Error duplicating publication:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-muted/20">
          <div>
            <h3 className="text-lg font-bold text-foreground">
              {isEditing ? "Editar Publicação" : "Nova Publicação Editorial"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isEditing
                ? "Atualize o cronograma e os dados da publicação."
                : "Cadastre uma nova publicação no calendário escolar 2026."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher for editing */}
        {isEditing && (
          <div className="flex border-b border-border bg-muted/10 px-5 pt-2">
            <button
              onClick={() => setActiveTab("details")}
              className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-all ${
                activeTab === "details"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Detalhes &amp; Edição
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === "history"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Histórico de Alterações ({publication?.history?.length || 0})
            </button>
          </div>
        )}

        {activeTab === "history" && publication?.history ? (
          <div className="p-6 max-h-[460px] overflow-y-auto space-y-3">
            {publication.history.map((h, i) => (
              <div
                key={i}
                className="p-3 rounded-lg border border-border bg-muted/20 text-xs space-y-1"
              >
                <div className="flex items-center justify-between font-semibold text-foreground">
                  <span>{h.action}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(h.timestamp).toLocaleString("pt-BR")}
                  </span>
                </div>
                <p className="text-muted-foreground">{h.details}</p>
                <p className="text-[11px] text-muted-foreground/80">
                  Responsável: <span className="font-medium text-foreground">{h.userName}</span>
                </p>
              </div>
            ))}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
            {/* Conflict Warning */}
            {conflict && (
              <div className="p-3 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Atenção - Conflito de Data:</span> Já existe{" "}
                  {conflict.count} outra(s) publicação(ões) agendada(s) para {formatDateForDisplay(publicationDate)}.
                </div>
              </div>
            )}

            {/* Past Planned Date Warning */}
            {isPastPlanned && (
              <div className="p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-900 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Alerta de Prazo:</span> O prazo de produção previsto (
                  {formatDateForDisplay(plannedDate)}) já passou e a publicação ainda não foi concluída!
                </div>
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Título da Publicação
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Projeto Robótica &amp; Inovação"
                className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>

            {/* Category & Series */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Categoria *
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => handleCategoryOrSeriesChange(e.target.value, seriesId)}
                  className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Série Escolar
                </label>
                <select
                  value={seriesId}
                  onChange={(e) => handleCategoryOrSeriesChange(categoryId, e.target.value)}
                  className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  {series.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Dates & Automatic Calculation */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl border border-border bg-muted/20">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Data de Publicação *
                </label>
                <input
                  type="date"
                  required
                  value={publicationDate}
                  onChange={(e) => setPublicationDate(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs rounded-lg border border-border bg-background text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Prazo (Dias Úteis)
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={productionDays}
                  onChange={(e) => setProductionDays(parseInt(e.target.value, 10) || 1)}
                  className="w-full h-9 px-2.5 text-xs rounded-lg border border-border bg-background text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Data Prevista Produção
                </label>
                <div className="h-9 px-2.5 text-xs font-bold rounded-lg border border-border bg-background text-primary flex items-center">
                  {plannedDate ? formatDateForDisplay(plannedDate) : "—"}
                </div>
              </div>
            </div>

            {/* Status & Priority */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as PublicationStatus)}
                  className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-background text-foreground"
                >
                  {DEFAULT_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Prioridade
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-background text-foreground"
                >
                  {DEFAULT_PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Responsible */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Responsável / Solicitante
              </label>
              <input
                type="text"
                value={responsibleName}
                onChange={(e) => setResponsibleName(e.target.value)}
                placeholder="Ex: Coordenação Pedagógica / Profª Camila"
                className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-background text-foreground"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Descrição &amp; Briefing
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes sobre a cobertura, referências visuais, objetivos e público-alvo..."
                className="w-full p-3 text-sm rounded-lg border border-border bg-background text-foreground resize-none"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Tags (Pressione Enter para adicionar)
              </label>
              <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg border border-border bg-background min-h-[42px]">
                {tags
                  .filter((t) => !t.startsWith("apt:"))
                  .map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary font-medium"
                  >
                    #{t}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      className="hover:text-rose-600 ml-0.5"
                    >
                      &times;
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  placeholder="Adicionar tag..."
                  className="text-xs bg-transparent border-none outline-none flex-1 min-w-[100px] text-foreground"
                />
              </div>
            </div>

            {/* Vínculo com o Controle de Publicações (sessões fotográficas) */}
            {(candidateAppointments.length > 0 || linkedAptIds.length > 0) && (
              <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3.5 space-y-2">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-violet-600" />
                  <span className="text-xs font-bold text-violet-900">
                    Vincular ao Controle de Publicações (sessões fotográficas)
                  </span>
                </div>
                <p className="text-[11px] text-violet-800/80">
                  Marque as sessões da série {series.find((s) => s.id === seriesId)?.name ?? seriesId}
                  {" • "}
                  {categories.find((c) => c.id === categoryId)?.name ?? categoryId}.
                  Ao salvar, o status escolhido aqui é aplicado às sessões marcadas
                  (ex.: Publicado → publica as sessões vinculadas).
                </p>
                {candidateAppointments.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    Nenhuma sessão fotográfica encontrada para esta categoria/série.
                  </p>
                ) : (
                  <ul className="space-y-1 max-h-40 overflow-y-auto">
                    {candidateAppointments.map((a) => {
                      const checked = linkedAptIds.includes(a.id);
                      const aptSt = normalizeAppointmentStatus(a.status as unknown as string) ?? String(a.status);
                      return (
                        <li key={a.id}>
                          <label
                            className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs cursor-pointer transition-colors ${
                              checked
                                ? "border-violet-400 bg-violet-100/70"
                                : "border-border bg-background hover:bg-accent/50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleLinkedApt(a.id)}
                              className="accent-violet-600"
                            />
                            <span className="font-bold text-foreground">
                              {resolveClassName(a, classes ?? []) || a.className || "Turma"}
                            </span>
                            {a.subject && (
                              <span className="text-muted-foreground">• {a.subject}</span>
                            )}
                            <span className="text-muted-foreground tabular-nums">
                              • {formatDateForDisplay(a.appointmentDate)}
                            </span>
                            <span className="ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700">
                              {aptSt}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {/* Inline Delete Confirmation Box */}
            {showDeleteConfirm && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200 space-y-2.5 mt-4">
                <div className="flex items-center gap-2 font-bold text-xs text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Confirmação de Exclusão Permanente</span>
                </div>
                <p className="text-xs text-rose-700/90 dark:text-rose-300/90">
                  Tem certeza que deseja excluir o registro de &ldquo;<strong>{publication?.title}</strong>&rdquo;? O registro será removido permanentemente.
                </p>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleConfirmDelete}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {isSaving ? "Excluindo..." : "Sim, Excluir Agora"}
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-background border border-border text-foreground hover:bg-accent transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Inline Duplicate Box */}
            {showDuplicatePrompt && (
              <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200 space-y-2.5 mt-4">
                <div className="flex items-center gap-2 font-bold text-xs text-blue-700 dark:text-blue-300">
                  <Copy className="w-4 h-4 text-primary shrink-0" />
                  <span>Duplicar Publicação</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <label className="text-xs text-muted-foreground">Nova Data:</label>
                  <input
                    type="date"
                    required
                    value={duplicateDateInput}
                    onChange={(e) => setDuplicateDateInput(e.target.value)}
                    className="h-8 px-2.5 text-xs rounded-lg border border-border bg-background text-foreground"
                  />
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={handleConfirmDuplicate}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 shadow-xs"
                    >
                      {isSaving ? "Copiando..." : "Confirmar Cópia"}
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => setShowDuplicatePrompt(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-background border border-border text-foreground hover:bg-accent"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Actions Bar */}
            <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
              <div className="flex items-center gap-2">
                {isEditing && (
                  <>
                    <button
                      type="button"
                      onClick={handleDeleteClick}
                      className="px-3 py-2 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors flex items-center gap-1.5"
                      title="Excluir publicação"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Excluir
                    </button>
                    <button
                      type="button"
                      onClick={handleDuplicateClick}
                      className="px-3 py-2 rounded-lg text-xs font-semibold text-foreground hover:bg-accent border border-border flex items-center gap-1.5 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Duplicar
                    </button>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={isSaving || showDeleteConfirm}
                  className="px-5 py-2 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {isSaving ? "Salvando..." : isEditing ? "Salvar Alterações" : "Criar Publicação"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
