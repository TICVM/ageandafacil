"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  X,
  GraduationCap,
  AlertTriangle,
  CheckCircle2,
  CalendarDays,
  Sparkles,
  Plus,
  Trash2,
} from "lucide-react";
import { Holiday, Publication, Priority } from "@/lib/calendar/types";
import { DEFAULT_SERIES } from "@/lib/calendar/constants";
import { formatDateForDisplay, getMonthName } from "@/lib/calendar/utils";
import {
  ANNUAL_PEDAGOGICAL_EVENTS,
  resolveAnnualEvents,
  expandMultiDayEvents,
  buildEventPublication,
  findOutdatedPedagogicalGenerated,
  getExistingEventKeys,
  loadCustomPedagogicalEvents,
  addCustomPedagogicalEvent,
  removeCustomPedagogicalEvent,
  type PedagogicalEventDef,
  type ResolvedPedagogicalEvent,
} from "@/lib/calendar/pedagogical-events";

interface GeneratePedagogicalPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  holidays: Holiday[];
  existingPublications: Publication[];
  onConfirm: (
    newPubs: Omit<Publication, "id">[],
    toRemove: Publication[]
  ) => Promise<void> | void;
}

const SERIES_NAME: Record<string, string> = Object.fromEntries(
  DEFAULT_SERIES.map((s) => [s.id, s.name])
);

export function GeneratePedagogicalPlanModal({
  isOpen,
  onClose,
  holidays,
  existingPublications,
  onConfirm,
}: GeneratePedagogicalPlanModalProps) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  // Eventos desmarcados pelo usuário (key → false). Pré-selecionados por padrão.
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  // Datas sobrescritas manualmente na prévia — POR OCORRÊNCIA
  // (`key@data-original` → YYYY-MM-DD): cada dia da CVM Education Week e dos
  // demais eventos multi-dia pode ser alterado individualmente.
  const [dateOverrides, setDateOverrides] = useState<Record<string, string>>({});
  const [skipExisting, setSkipExisting] = useState(true);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [saving, setSaving] = useState(false);
  // Formulário "Adicionar novo evento" (catálogo customizado — localStorage)
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(`${currentYear}-01-01`);
  const [newPriority, setNewPriority] = useState<Priority>("MEDIA");
  const [customEvents, setCustomEvents] = useState<PedagogicalEventDef[]>([]);

  useEffect(() => {
    setCustomEvents(loadCustomPedagogicalEvents());
  }, [isOpen]);

  const resolvedAll = useMemo(() => {
    if (!isOpen) return [] as ResolvedPedagogicalEvent[];
    try {
      // expandMultiDayEvents: eventos de vários dias (ex.: CVM Education
      // Week — dias 19, 20, 21, 22, 23, 26, 27, 28, 29 e 30 de janeiro)
      // viram uma publicação por dia na prévia e na geração.
      // getAllPedagogicalEvents: catálogo padrão + eventos adicionados aqui.
      return expandMultiDayEvents(
        resolveAnnualEvents(year, holidays, [...ANNUAL_PEDAGOGICAL_EVENTS, ...customEvents]),
        year,
        holidays
      );
    } catch {
      return [] as ResolvedPedagogicalEvent[];
    }
  }, [isOpen, year, holidays, customEvents]);

  const existingKeys = useMemo(
    () => getExistingEventKeys(existingPublications, year),
    [existingPublications, year]
  );

  const outdated = useMemo(
    () => findOutdatedPedagogicalGenerated(existingPublications, year),
    [existingPublications, year]
  );

  // Lista final que será gerada: aplica exclusões + overrides de data + filtro de existentes
  const selected = useMemo(() => {
    // Dedupe por (key, date): eventos multi-dia expandidos podem gerar
    // ocorrências duplicadas quando uma data é sobrescrita manualmente.
    const seen = new Set<string>();
    return resolvedAll.filter((ev) => {
      if (excluded.has(ev.key)) return false;
      if (skipExisting && !replaceExisting && existingKeys.has(ev.key)) return false;
      const id = `${ev.key}@${ev.date}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [resolvedAll, excluded, skipExisting, replaceExisting, existingKeys]);

  /** Chave única por linha da prévia (eventos multi-dia repetem a mesma key). */
  const occurrenceId = (ev: ResolvedPedagogicalEvent): string =>
    `${ev.key}@${ev.date}`;

  const publications = useMemo(() => {
    return selected.map((ev) => {
      // Override de data POR OCORRÊNCIA — cada dia da CVM Education Week
      // (e de qualquer evento multi-dia) pode ser alterado individualmente.
      const overrideDate = dateOverrides[occurrenceId(ev)];
      const effectiveEv: ResolvedPedagogicalEvent = overrideDate
        ? { ...ev, date: overrideDate, originalDate: ev.date, wasAdjusted: false }
        : ev;
      return buildEventPublication(effectiveEv, holidays);
    });
  }, [selected, dateOverrides, holidays]);

  if (!isOpen) return null;

  const alreadyThereCount = resolvedAll.filter((e) => existingKeys.has(e.key)).length;

  const toggleEvent = (key: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => setExcluded(new Set());
  const clearAll = () => setExcluded(new Set(resolvedAll.map((e) => e.key)));

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await onConfirm(publications, replaceExisting ? outdated : []);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  /** Adiciona um novo evento (data fixa) ao catálogo customizado do gerador. */
  const handleAddCustomEvent = () => {
    if (!newTitle.trim() || !newDate) return;
    const [y, m, d] = newDate.split("-").map(Number);
    const list = addCustomPedagogicalEvent({
      title: newTitle.trim(),
      rule: { kind: "fixed", month: m, day: d },
      priority: newPriority,
      keepDate: true,
      description: "Evento adicionado manualmente ao plano anual.",
    });
    setCustomEvents(list);
    setNewTitle("");
    setShowAddForm(false);
    // Garante que o novo evento entre selecionado na prévia do ano escolhido.
    void y;
  };

  const handleRemoveCustomEvent = (key: string) => {
    setCustomEvents(removeCustomPedagogicalEvent(key));
  };

  // Preview agrupado por mês
  const byMonth = new Map<string, { ev: ResolvedPedagogicalEvent; checked: boolean }[]>();
  for (const ev of resolvedAll) {
    const key = ev.date.substring(0, 7);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push({ ev, checked: !excluded.has(ev.key) });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-border">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2 min-w-0">
            <GraduationCap className="w-5 h-5 shrink-0 text-primary" />
            <h2 className="text-base sm:text-lg font-bold text-foreground leading-tight truncate">
              Gerar Plano Anual de Eventos Pedagógicos
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-muted text-muted-foreground shrink-0"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          <p className="text-sm text-muted-foreground">
            Cria automaticamente as publicações dos{" "}
            <strong>{ANNUAL_PEDAGOGICAL_EVENTS.length} eventos pedagógicos</strong> que se
            repetem todos os anos (Volta às Aulas, Carnaval, Páscoa, Dia das Mães/Pais,
            Reuniões de Pais, Festa Junina, Spelling Bee, Formaturas…). As datas móveis
            (Carnaval, Páscoa, Corpus Christi, Dia das Mães/Pais…) são calculadas para o ano
            escolhido; se caírem em fim de semana ou feriado, são deslocadas para o próximo
            dia útil — exceto as datas simbólicas. Revise, ajuste datas ou desmarque eventos
            antes de confirmar.
          </p>

          {/* Ano */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Ano</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                {Array.from({ length: 7 }, (_, i) => currentYear - 2 + i).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <p className="text-xs text-muted-foreground">
                {alreadyThereCount > 0 && (
                  <>
                    <AlertTriangle className="inline w-3.5 h-3.5 mr-1 text-amber-500" />
                    {alreadyThereCount} evento(s) já existe(m) no Controle de Publicações de {year}.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Opções de duplicidade */}
          <div className="rounded-xl border border-border p-4 space-y-2">
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={skipExisting}
                onChange={(e) => setSkipExisting(e.target.checked)}
                className="mt-0.5 accent-primary"
              />
              <span className="text-foreground">
                Ignorar eventos que já existem no plano anual de {year}.
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={replaceExisting}
                onChange={(e) => setReplaceExisting(e.target.checked)}
                className="mt-0.5 accent-primary"
              />
              <span className="text-foreground">
                Substituir as {outdated.length} publicação(ões) de eventos pedagógicos já
                geradas para {year} (recria com as datas recalculadas).
              </span>
            </label>
          </div>

          {/* Resumo */}
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span className="flex items-center gap-1.5 font-semibold text-foreground">
                <CalendarDays className="w-4 h-4 text-primary" />
                {publications.length} eventos serão criados
              </span>
              <span className="text-muted-foreground text-xs">
                {resolvedAll.length - selected.length} não selecionados/existentes
              </span>
            </div>
          </div>

          {/* Prévia editável */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-foreground">Prévia do plano anual</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm((v) => !v)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-md border border-primary/40 text-primary hover:bg-primary/10 inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar novo evento
                </button>
                <button
                  type="button"
                  onClick={selectAll}
                  className="px-2.5 py-1 text-xs font-semibold rounded-md border border-border hover:bg-accent"
                >
                  Selecionar todos
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  className="px-2.5 py-1 text-xs font-semibold rounded-md border border-border hover:bg-accent"
                >
                  Limpar
                </button>
              </div>
            </div>

            {/* Formulário de novo evento (catálogo customizado — entra no
                gerador junto com os eventos recorrentes em qualquer ano) */}
            {showAddForm && (
              <div className="mb-3 rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
                <p className="text-xs font-bold text-foreground">Novo evento do plano anual</p>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Nome do evento"
                    className="sm:col-span-2 rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                  />
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                  />
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as Priority)}
                    className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                  >
                    <option value="BAIXA">Baixa</option>
                    <option value="MEDIA">Média</option>
                    <option value="ALTA">Alta</option>
                    <option value="URGENTE">Urgente</option>
                  </select>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-muted-foreground">
                    O evento fica salvo no catálogo e é sugerido em todas as gerações
                    (em cada ano ele cai na mesma data informada).
                  </p>
                  <button
                    type="button"
                    onClick={handleAddCustomEvent}
                    disabled={!newTitle.trim() || !newDate}
                    className="px-3 py-1.5 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shrink-0"
                  >
                    Adicionar
                  </button>
                </div>
              </div>
            )}

            <div className="max-h-80 overflow-y-auto rounded-xl border border-border divide-y divide-border">
              {Array.from(byMonth.entries()).map(([monthKey, items]) => (
                <div key={monthKey} className="px-3 py-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
                    {getMonthName(Number(monthKey.split("-")[1]) - 1)} / {monthKey.split("-")[0]}
                  </p>
                  <ul className="space-y-1">
                    {items.map(({ ev }) => {
                      const isChecked = !excluded.has(ev.key);
                      const oid = occurrenceId(ev);
                      // Override de data POR OCORRÊNCIA — cada dia da CVM
                      // Education Week pode ser alterado individualmente.
                      const override = dateOverrides[oid];
                      const displayDate = override ?? ev.date;
                      return (
                        <li
                          key={oid}
                          className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs"
                        >
                          <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleEvent(ev.key)}
                              className="accent-primary shrink-0"
                            />
                            <span
                              className={`truncate ${isChecked ? "text-foreground" : "text-muted-foreground line-through"}`}
                            >
                              {ev.title}
                              {ev.multiDay && !/^Dia \d+/.test(ev.title)
                                ? ` — Dia ${Number(ev.date.slice(8, 10))}`
                                : ""}
                            </span>
                            {ev.custom && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold shrink-0">
                                custom
                              </span>
                            )}
                            {ev.seriesId && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                                {SERIES_NAME[ev.seriesId] ?? ev.seriesId}
                              </span>
                            )}
                            {ev.wasAdjusted && !override && (
                              <span
                                className="text-[10px] text-amber-600 shrink-0"
                                title={`Data original: ${formatDateForDisplay(ev.originalDate)} (deslocada por fim de semana/feriado)`}
                              >
                                ajustada
                              </span>
                            )}
                          </label>
                          <input
                            type="date"
                            value={displayDate}
                            disabled={!isChecked}
                            onChange={(e) =>
                              setDateOverrides((prev) => ({
                                ...prev,
                                [oid]: e.target.value,
                              }))
                            }
                            className="rounded-md border border-input bg-background px-2 py-1 text-xs disabled:opacity-40"
                          />
                          {ev.custom && (
                            <button
                              type="button"
                              onClick={() => handleRemoveCustomEvent(ev.key)}
                              className="p-1 rounded-md text-muted-foreground hover:text-rose-600 hover:bg-rose-50 shrink-0"
                              title="Remover este evento customizado do catálogo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            As publicações entram no calendário com status &quot;Planejamento&quot;, categoria
            Eventos Pedagógicos e tag interna para evitar duplicação em novas gerações.
          </p>
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-4 border-t border-border sticky bottom-0 bg-card">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold border border-border hover:bg-muted text-center"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving || publications.length === 0}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            {saving ? "Gerando..." : `Gerar ${publications.length} publicações`}
          </button>
        </div>
      </div>
    </div>
  );
}
