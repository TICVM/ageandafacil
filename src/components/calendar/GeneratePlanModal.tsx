"use client";

import React, { useMemo, useState } from "react";
import { X, Wand2, AlertTriangle, CheckCircle2, CalendarDays } from "lucide-react";
import { Holiday, Publication } from "@/lib/calendar/types";
import { DEFAULT_SERIES } from "@/lib/calendar/constants";
import { generateMandatoryPublications, findOutdatedGenerated } from "@/lib/calendar/generate-mandatory";
import { formatDateForDisplay, getMonthName } from "@/lib/calendar/utils";

interface GeneratePlanModalProps {
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

export function GeneratePlanModal({
  isOpen,
  onClose,
  holidays,
  existingPublications,
  onConfirm,
}: GeneratePlanModalProps) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [startDate, setStartDate] = useState(`${year}-02-10`);
  const [endDate, setEndDate] = useState(`${year}-09-30`);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [saving, setSaving] = useState(false);

  const result = useMemo(() => {
    if (!isOpen) return null;
    try {
      return generateMandatoryPublications({ year, startDate, endDate }, holidays);
    } catch {
      return null;
    }
  }, [isOpen, year, startDate, endDate, holidays]);

  const outdated = useMemo(
    () => (result ? findOutdatedGenerated(existingPublications, year) : []),
    [result, existingPublications, year]
  );

  if (!isOpen || !result) return null;

  const avCount = result.publications.filter((p) => p.categoryId === "ATIVIDADES_VARIADAS").length;
  const pbCount = result.publications.filter((p) => p.categoryId === "PROGRAMA_BILINGUE").length;

  // Preview agrupado por mês
  const byMonth = new Map<string, { date: string; series: string; cat: string }[]>();
  for (const p of result.publications) {
    const key = p.publicationDate.substring(0, 7);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push({
      date: p.publicationDate,
      series: SERIES_NAME[p.seriesId || ""] || p.seriesId || "-",
      cat: p.categoryId === "ATIVIDADES_VARIADAS" ? "Atividades Variadas" : "Programa Bilíngue",
    });
  }

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await onConfirm(result.publications, replaceExisting ? outdated : []);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
          <div className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Gerar Publicações Obrigatórias</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-sm text-muted-foreground">
            Cria automaticamente <strong>27 publicações obrigatórias</strong>: 15 de{" "}
            <span className="font-semibold text-teal-600">Atividades Variadas</span> (Maternal ao 3º Médio) e
            12 do <span className="font-semibold text-purple-600">Programa Bilíngue</span> (Maternal ao 9º Ano).
            São distribuídas <strong>1 por semana</strong>, alternando séries e categorias, nunca em finais de
            semana ou feriados, sem título e com status <strong>Planejamento</strong>.
          </p>

          {/* Período */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Ano</label>
              <select
                value={year}
                onChange={(e) => {
                  const y = Number(e.target.value);
                  setYear(y);
                  setStartDate(`${y}-02-10`);
                  setEndDate(`${y}-09-30`);
                }}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                {Array.from({ length: 7 }, (_, i) => currentYear - 2 + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Início do período</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Fim do período</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Resumo */}
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span className="flex items-center gap-1.5 font-semibold text-foreground">
                <CalendarDays className="w-4 h-4 text-primary" />
                {result.publications.length} publicações planejadas
              </span>
              <span className="text-teal-600 font-medium">{avCount} Atividades Variadas</span>
              <span className="text-purple-600 font-medium">{pbCount} Programa Bilíngue</span>
              {result.skippedWeekendsAndHolidays > 0 && (
                <span className="text-muted-foreground text-xs">
                  ({result.skippedWeekendsAndHolidays} dias pulados por fim de semana/feriado)
                </span>
              )}
            </div>
            {result.warnings.length > 0 && (
              <div className="mt-3 space-y-1">
                {result.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-600 flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {w}
                  </p>
                ))}
              </div>
            )}
            {result.publications.length < 27 && result.warnings.length === 0 && (
              <p className="mt-2 text-xs text-amber-600 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                O período selecionado não comporta as 27 publicações com 1 por semana. Amplie a data final.
              </p>
            )}
          </div>

          {/* Preview */}
          <div>
            <h3 className="text-sm font-bold text-foreground mb-2">Prévia do cronograma</h3>
            <div className="max-h-56 overflow-y-auto rounded-xl border border-border divide-y divide-border">
              {Array.from(byMonth.entries()).map(([monthKey, items]) => (
                <div key={monthKey} className="px-3 py-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
                    {getMonthName(Number(monthKey.split("-")[1]) - 1)} / {monthKey.split("-")[0]}
                  </p>
                  <ul className="space-y-0.5">
                    {items.map((it, i) => (
                      <li key={i} className="flex items-center justify-between text-xs">
                        <span className="text-foreground">{it.series}</span>
                        <span className={it.cat === "Atividades Variadas" ? "text-teal-600" : "text-purple-600"}>
                          {it.cat}
                        </span>
                        <span className="text-muted-foreground">{formatDateForDisplay(it.date)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Substituir existentes */}
          {outdated.length > 0 && (
            <label className="flex items-start gap-2 text-sm cursor-pointer rounded-xl border border-border p-3 hover:bg-muted/40">
              <input
                type="checkbox"
                checked={replaceExisting}
                onChange={(e) => setReplaceExisting(e.target.checked)}
                className="mt-0.5 accent-primary"
              />
              <span className="text-foreground">
                Substituir <strong>{outdated.length}</strong> publicação(ões) obrigatória(s) já gerada(s) para{" "}
                {year} (título vazio, status Planejamento).
              </span>
            </label>
          )}

          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            As novas publicações entram no calendário com título vazio e status "Planejamento". Você pode editar
            cada uma clicando nela.
          </p>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border sticky bottom-0 bg-card">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold border border-border hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving || result.publications.length === 0}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            <Wand2 className="w-4 h-4" />
            {saving ? "Gerando..." : `Gerar ${result.publications.length} publicações`}
          </button>
        </div>
      </div>
    </div>
  );
}
