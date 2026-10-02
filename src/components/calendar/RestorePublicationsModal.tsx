"use client";

import React, { useMemo, useState } from "react";
import { X, RotateCcw, AlertTriangle, CheckCircle2, Plus } from "lucide-react";
import { Holiday, Publication } from "@/lib/calendar/types";
import { DEFAULT_SERIES } from "@/lib/calendar/constants";
import {
  findMissingMandatorySeries,
  restoreMissingMandatoryPublications,
} from "@/lib/calendar/generate-mandatory";

interface RestorePublicationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  year: number;
  holidays: Holiday[];
  publications: Publication[];
  /** Persiste as publicações restauradas (cria/atualiza) — ver AppHome. */
  onRestore: (
    toCreate: Omit<Publication, "id">[],
    toUpdate: Array<{ id: string; updates: Partial<Publication> }>
  ) => Promise<void> | void;
}

const SERIES_NAME: Record<string, string> = Object.fromEntries(
  DEFAULT_SERIES.map((s) => [s.id, s.name])
);

const CATEGORY_NAME: Record<string, string> = {
  ATIVIDADES_VARIADAS: "Atividades Variadas",
  PROGRAMA_BILINGUE: "Programa Bilíngue",
};

/**
 * Modal "Restaurar publicações do plano anual".
 *
 * Resolve o problema de uma publicação obrigatória que saiu da tabela do
 * Controle de Publicações após uma alteração (ex.: 5º Ano do Programa
 * Bilíngue): ela pode ter sido excluída, perdido as tags do plano anual ou
 * tido a data movida para outro ano. O modal detecta as séries sem
 * publicação obrigatória no ano, mostra qual data será usada e restaura
 * cada uma com um clique.
 */
export function RestorePublicationsModal({
  isOpen,
  onClose,
  year,
  holidays,
  publications,
  onRestore,
}: RestorePublicationsModalProps) {
  // Combinações série × categoria marcadas para restauração.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  const missing = useMemo(
    () => (isOpen ? findMissingMandatorySeries(publications, year) : []),
    [isOpen, publications, year]
  );

  // Prévia: quais datas serão usadas (mesma função aplicada na confirmação).
  const preview = useMemo(() => {
    if (!isOpen || missing.length === 0) return [];
    try {
      const { toCreate, toUpdate } = restoreMissingMandatoryPublications({
        year,
        targets: missing,
        holidays,
        existing: publications,
      });
      return [...toCreate, ...toUpdate.map((u) => ({ ...u.updates, _id: u.id } as any))].map(
        (p: any) => ({
          categoryId: p.categoryId,
          seriesId: p.seriesId,
          publicationDate: p.publicationDate,
          updating: !!p._id,
        })
      );
    } catch {
      return [];
    }
  }, [isOpen, missing, year, holidays, publications]);

  if (!isOpen) return null;

  const keyOf = (categoryId: string, seriesId: string) => `${categoryId}|${seriesId}`;

  const toggle = (key: string) => {
    setDone(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const targets = missing.filter((m) => selected.has(keyOf(m.categoryId, m.seriesId)));
  const chosenPreview = preview.filter((p) =>
    selected.has(keyOf(p.categoryId, p.seriesId))
  );

  const selectAll = () => {
    setDone(null);
    setSelected(new Set(missing.map((m) => keyOf(m.categoryId, m.seriesId))));
  };

  const handleRestore = async () => {
    if (targets.length === 0) return;
    setSaving(true);
    try {
      const { toCreate, toUpdate } = restoreMissingMandatoryPublications({
        year,
        targets,
        holidays,
        existing: publications,
      });
      await onRestore(toCreate, toUpdate);
      setDone(toCreate.length + toUpdate.length);
      setSelected(new Set());
    } finally {
      setSaving(false);
    }
  };

  const formatDateBR = (iso?: string) => {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">
              Restaurar publicações do plano anual
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Publicações obrigatórias que <strong>não estão aparecendo</strong> na
            tabela do Controle de Publicações em <strong>{year}</strong> — por
            terem sido excluídas ou por estarem com a data em outro ano.
            Selecione as linhas abaixo e clique em{" "}
            <strong>Restaurar selecionadas</strong> para colocá-las de volta.
          </p>

          {done !== null && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              <CheckCircle2 className="w-4 h-4" />
              {done} publicação(ões) restaurada(s) com sucesso.
            </div>
          )}

          {missing.length === 0 ? (
            <div className="rounded-xl border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              Nenhuma publicação faltando em {year}. As 15 séries de Atividades
              Variadas e as 12 do Programa Bilíngue estão na tabela. ✅
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {missing.length} publicação(ões) faltando
                </span>
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  Selecionar todas
                </button>
              </div>

              <ul className="space-y-1.5 max-h-72 overflow-y-auto border border-border rounded-xl p-2">
                {missing.map((m) => {
                  const key = keyOf(m.categoryId, m.seriesId);
                  const checked = selected.has(key);
                  const prev = preview.find(
                    (p) => p.categoryId === m.categoryId && p.seriesId === m.seriesId
                  );
                  return (
                    <li key={key}>
                      <label
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
                          checked
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-accent/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(key)}
                          className="accent-[var(--primary, #2563eb)]"
                        />
                        <span className="font-bold whitespace-nowrap">
                          {SERIES_NAME[m.seriesId] ?? m.seriesId}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                            m.categoryId === "PROGRAMA_BILINGUE"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-teal-100 text-teal-700"
                          }`}
                        >
                          {CATEGORY_NAME[m.categoryId] ?? m.categoryId}
                        </span>
                        <span className="ml-auto text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                          {prev
                            ? `${prev.updating ? "corrige data → " : "volta com data "}${formatDateBR(
                                prev.publicationDate
                              )}`
                            : ""}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>

              {targets.length > 0 && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Serão restauradas {targets.length} publicação(ões):{" "}
                    {chosenPreview
                      .map(
                        (p) =>
                          `${SERIES_NAME[p.seriesId] ?? p.seriesId} (${
                            CATEGORY_NAME[p.categoryId] ?? p.categoryId
                          } — ${formatDateBR(p.publicationDate)})`
                      )
                      .join("; ")}
                    .
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border sticky bottom-0 bg-card">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-accent"
          >
            Fechar
          </button>
          <button
            type="button"
            disabled={targets.length === 0 || saving}
            onClick={handleRestore}
            className="px-4 py-2 text-sm font-bold rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <RotateCcw className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Restaurar selecionadas{targets.length > 0 ? ` (${targets.length})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
