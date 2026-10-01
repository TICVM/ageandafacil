"use client";

import React, { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Table2 } from "lucide-react";
import { Publication, PublicationStatus, Series, Category } from "@/lib/calendar/types";
import { DEFAULT_SERIES, DEFAULT_STATUSES } from "@/lib/calendar/constants";

/**
 * Aba "Controle de Publicações": duas tabelas — Atividades Variadas e
 * Programa Bilíngue — no formato Série | Data Prevista | Data da Publicação.
 *
 * - Filtra as publicações obrigatórias geradas (tags "obrigatoria"/"plano-anual")
 *   por categoria e ano selecionável.
 * - A coluna "Data da Publicação" é editável: o usuário pode ajustar as datas
 *   geradas automaticamente sem abrir o modal (grava publicationDate + status).
 * - Publicações já realizadas exibem um visto verde.
 */

const AV_CATEGORY_ID = "ATIVIDADES_VARIADAS";
const PB_CATEGORY_ID = "PROGRAMA_BILINGUE";

interface ControlTablesProps {
  publications: Publication[];
  seriesList?: Series[];
  categories?: Category[];
  onUpdatePublication: (id: string, updates: Partial<Publication>) => Promise<void> | void;
  onSelectPublication?: (pub: Publication) => void;
}

interface RowData {
  pub: Publication;
  seriesName: string;
}

function isMandatory(p: Publication): boolean {
  const tags = p.tags ?? [];
  return tags.includes("obrigatoria") || tags.includes("plano-anual");
}

function formatDateBR(iso?: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function weekdayLabel(iso?: string): string {
  if (!iso) return "";
  const dt = new Date(`${iso}T12:00:00`);
  if (isNaN(dt.getTime())) return "";
  try {
    return dt.toLocaleDateString("pt-BR", { weekday: "long" });
  } catch {
    return "";
  }
}

function StatusBadge({
  status,
  onClick,
}: {
  status: PublicationStatus;
  onClick: () => void;
}) {
  const meta = DEFAULT_STATUSES.find((s) => s.value === status);
  return (
    <button
      type="button"
      onClick={onClick}
      title="Clique para alternar o status (marcar como Publicado)"
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border border-transparent transition-opacity hover:opacity-80 ${
        meta ? `${meta.bg} ${meta.color}` : "bg-muted text-muted-foreground"
      }`}
    >
      {status === "PUBLICADO" && <CheckCircle2 className="w-3 h-3 text-green-600" />}
      {meta?.label ?? status}
    </button>
  );
}

function PublicationTable({
  title,
  accentClass,
  rows,
  year,
  onUpdateDate,
  onCycleStatus,
  onSelect,
}: {
  title: string;
  accentClass: string;
  rows: RowData[];
  year: number;
  onUpdateDate: (pub: Publication, dateISO: string) => void;
  onCycleStatus: (pub: Publication) => void;
  onSelect?: (pub: Publication) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
      <header
        className={`flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-border ${accentClass}`}
      >
        <div className="flex items-center gap-2">
          <Table2 className="w-4 h-4" />
          <h3 className="text-sm font-extrabold tracking-tight">{title}</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/70 text-foreground">
            {rows.length} {rows.length === 1 ? "publicação" : "publicações"} • {year}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-1 text-[11px] font-bold opacity-80 hover:opacity-100 transition-opacity"
          title={collapsed ? "Estender tabela" : "Recolher tabela"}
        >
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          <span className="hidden sm:inline">{collapsed ? "Estender" : "Recolher"}</span>
        </button>
      </header>

      {!collapsed &&
        (rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma publicação desta categoria em {year}. Use{" "}
            <span className="font-bold">Gerar Plano Anual</span> para criar as
            publicações obrigatórias.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/40">
                  <th className="px-4 sm:px-5 py-2.5 font-bold">Série</th>
                  <th className="px-4 sm:px-5 py-2.5 font-bold">Data Prevista</th>
                  <th className="px-4 sm:px-5 py-2.5 font-bold">Data da Publicação</th>
                  <th className="px-4 sm:px-5 py-2.5 font-bold">Título da Publicação</th>
                  <th className="px-4 sm:px-5 py-2.5 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ pub, seriesName }) => {
                  const published = pub.status === "PUBLICADO";
                  return (
                    <tr
                      key={pub.id}
                      className="border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 sm:px-5 py-2.5 font-bold text-foreground whitespace-nowrap">
                        {seriesName}
                      </td>
                      <td className="px-4 sm:px-5 py-2.5 whitespace-nowrap tabular-nums">
                        {formatDateBR(pub.plannedDate)}
                      </td>
                      <td className="px-4 sm:px-5 py-2 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <input
                            type="date"
                            value={pub.publicationDate}
                            onChange={(e) => onUpdateDate(pub, e.target.value)}
                            className="w-[150px] rounded-lg border border-input bg-background px-2 py-1 text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-[10px] text-muted-foreground capitalize pl-0.5">
                            {weekdayLabel(pub.publicationDate)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 sm:px-5 py-2.5 max-w-[220px]">
                        <button
                          type="button"
                          onClick={() => onSelect?.(pub)}
                          className="text-left truncate block w-full text-muted-foreground hover:text-foreground hover:underline"
                          title={pub.title || "Sem título — clique para editar"}
                        >
                          {pub.title || <em>Sem título</em>}
                        </button>
                      </td>
                      <td className="px-4 sm:px-5 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <StatusBadge
                            status={pub.status}
                            onClick={() => onCycleStatus(pub)}
                          />
                          {published && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" aria-label="Publicada" />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
    </section>
  );
}

export function ControlTables({
  publications,
  seriesList,
  categories,
  onUpdatePublication,
  onSelectPublication,
}: ControlTablesProps) {
  const allSeries = seriesList && seriesList.length > 0 ? seriesList : DEFAULT_SERIES;

  const years = useMemo(() => {
    const set = new Set<number>();
    publications
      .filter((p) => !p.isDeleted && isMandatory(p))
      .forEach((p) => {
        const y = Number(p.publicationDate.slice(0, 4));
        if (!isNaN(y)) set.add(y);
      });
    if (set.size === 0) set.add(new Date().getFullYear());
    return Array.from(set).sort((a, b) => a - b);
  }, [publications]);

  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const nowY = new Date().getFullYear();
    return nowY;
  });

  // Garante que o ano selecionado exista na lista
  const activeYear = years.includes(selectedYear) ? selectedYear : years[0];

  const seriesNameById = useMemo(() => {
    const map = new Map<string, string>();
    allSeries.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [allSeries]);

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    (categories ?? []).forEach((c) => map.set(c.id, c.name));
    map.set(AV_CATEGORY_ID, map.get(AV_CATEGORY_ID) ?? "Atividades Variadas");
    map.set(PB_CATEGORY_ID, map.get(PB_CATEGORY_ID) ?? "Programa Bilíngue");
    return map;
  }, [categories]);

  const buildRows = (categoryId: string): RowData[] =>
    publications
      .filter(
        (p) =>
          !p.isDeleted &&
          isMandatory(p) &&
          p.categoryId === categoryId &&
          p.publicationDate.startsWith(String(activeYear))
      )
      .sort((a, b) => a.publicationDate.localeCompare(b.publicationDate))
      .map((pub) => ({
        pub,
        seriesName: seriesNameById.get(pub.seriesId ?? "") ?? pub.seriesId ?? "—",
      }));

  const avRows = buildRows(AV_CATEGORY_ID);
  const pbRows = buildRows(PB_CATEGORY_ID);

  const handleUpdateDate = async (pub: Publication, dateISO: string) => {
    if (!dateISO) return;
    await onUpdatePublication(pub.id, { publicationDate: dateISO });
  };

  const STATUS_CYCLE: PublicationStatus[] = [
    "PLANEJAMENTO",
    "AGENDADO",
    "PUBLICADO",
  ];

  const handleCycleStatus = async (pub: Publication) => {
    let next: PublicationStatus;
    if (pub.status === "PUBLICADO") {
      next = "PLANEJAMENTO";
    } else {
      const idx = STATUS_CYCLE.indexOf(pub.status);
      next = idx >= 0 && idx < STATUS_CYCLE.length - 1
        ? STATUS_CYCLE[idx + 1]
        : "AGENDADO";
    }
    await onUpdatePublication(pub.id, { status: next });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-foreground flex items-center gap-2">
            <Table2 className="w-5 h-5 text-blue-600" />
            Controle de Publicações
          </h2>
          <p className="text-sm text-muted-foreground">
            Publicações obrigatórias por série. Edite as datas diretamente na
            tabela e clique no status para publicar.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-bold">
          Ano:
          <select
            value={activeYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>

      <PublicationTable
        title={categoryNameById.get(AV_CATEGORY_ID) ?? "Atividades Variadas"}
        accentClass="bg-blue-50 dark:bg-blue-950/30"
        rows={avRows}
        year={activeYear}
        onUpdateDate={handleUpdateDate}
        onCycleStatus={handleCycleStatus}
        onSelect={onSelectPublication}
      />

      <PublicationTable
        title={categoryNameById.get(PB_CATEGORY_ID) ?? "Programa Bilíngue"}
        accentClass="bg-emerald-50 dark:bg-emerald-950/30"
        rows={pbRows}
        year={activeYear}
        onUpdateDate={handleUpdateDate}
        onCycleStatus={handleCycleStatus}
        onSelect={onSelectPublication}
      />
    </div>
  );
}
