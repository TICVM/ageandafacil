"use client";

import React, { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Link2, RotateCcw, Table2, X } from "lucide-react";
import { Publication, PublicationStatus, Series, Category } from "@/lib/calendar/types";
import { Appointment, AppointmentStatus, SchoolClass } from "@/lib/scheduler/types";
import { resolveClassName } from "@/lib/scheduler/association";
import {
  mapPublicationStatusToAppointment,
  normalizeAppointmentStatus,
  normalizePublicationStatus,
} from "@/lib/scheduler/status-mapping";
import { DEFAULT_SERIES, DEFAULT_STATUSES } from "@/lib/calendar/constants";

/** Chave canônica do status da sessão (banco pode trazer inglês minúsculo). */
const aptKey = (apt: Appointment): string =>
  normalizeAppointmentStatus(apt.status) ?? String(apt.status);

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
  /** Sessões fotográficas — usadas para exibir o vínculo automático por publicação. */
  appointments?: Appointment[];
  classes?: SchoolClass[];
  /** Atualiza o status de uma sessão fotográfica (ex.: marcar como PUBLICADO). */
  onUpdateAppointmentStatus?: (appointmentId: string, status: AppointmentStatus) => Promise<void> | void;
  /** Id da publicação cujo modal de edição está aberto — usada para pausar a sincronia automática. */
  editingPublicationId?: string | null;
  /** Função que define qual publicação está em edição (pausa a sincronia automática). */
  onSetEditingPublicationId?: (id: string | null) => void;
  /**
   * Abre o modal "Restaurar publicações do plano anual" para o ano indicado.
   * Usado pelo botão "Restaurar publicações" quando uma publicação obrigatória
   * (ex.: 5º Ano do Programa Bilíngue) saiu da tabela após uma alteração.
   */
  onRequestRestore?: (year: number) => void;
}

interface RowData {
  pub: Publication;
  seriesName: string;
  linkedSessions: Appointment[];
}

const APT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  EDITAR: "Editar",
  APROVACAO: "Em aprovação",
  APROVADO: "Aprovado",
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
  PUBLICADO: "Publicado",
  COMPLETED: "Concluído",
  REPROGRAMADO: "Reprogramado",
};

function aptStatusBadgeClass(status: string): string {
  switch (status) {
    case "CONFIRMED":
      return "bg-emerald-100 text-emerald-800";
    case "PENDING":
      return "bg-amber-100 text-amber-800";
    case "EDITAR":
      return "bg-orange-100 text-orange-800";
    case "APROVACAO":
      return "bg-purple-100 text-purple-800";
    case "APROVADO":
      return "bg-teal-100 text-teal-800";
    case "CANCELLED":
      return "bg-zinc-200 text-zinc-700";
    case "PUBLICADO":
      return "bg-violet-100 text-violet-800";
    case "COMPLETED":
      return "bg-sky-100 text-sky-800";
    default:
      return "bg-muted text-muted-foreground";
  }
}

/**
 * Painel "Sessões vinculadas": lista as sessões fotográficas associadas à
 * publicação (turma, disciplina, data e status), com opção de marcá-las
 * como publicadas diretamente da tabela.
 */
function LinkedSessionsPanel({
  row,
  classes,
  onClose,
  onUpdateAppointmentStatus,
}: {
  row: RowData;
  classes?: SchoolClass[];
  onClose: () => void;
  onUpdateAppointmentStatus?: (appointmentId: string, status: AppointmentStatus) => Promise<void> | void;
}) {
  const { pub, seriesName, linkedSessions } = row;
  return (
    <tr className="border-b border-border/60 last:border-0 bg-muted/30">
      <td colSpan={6} className="px-4 sm:px-5 py-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-2 mb-2">
          <div className="text-xs min-w-0">
            <span className="font-extrabold text-foreground">
              Sessões vinculadas — {seriesName}
            </span>
            <span className="text-muted-foreground">
              {" "}• {categoryLabelOf(pub.categoryId)} • {formatDateBR(pub.publicationDate)}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {linkedSessions.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Nenhuma sessão fotográfica vinculada a esta publicação. As sessões
            são associadas automaticamente conforme o status (Editar → Produção
            de Conteúdo, Em aprovação → Revisão/Aprovação, Aprovado → Aprovado
            para publicar, Confirmado → Agendado, Publicado → Publicado).
          </p>
        ) : (
          <ul className="space-y-1.5">
            {linkedSessions.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-start gap-1.5 sm:gap-2 text-xs bg-card border border-border/60 rounded-lg px-3 py-2"
              >
                <span className="font-bold text-foreground">
                  {resolveClassName(a, classes ?? []) || a.className || "Turma não informada"}
                </span>
                <span className="text-muted-foreground">
                  {a.subject ? `• ${a.subject}` : ""}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  • {formatDateBR(a.appointmentDate)} {a.startTime}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${aptStatusBadgeClass(
                    aptKey(a)
                  )}`}
                >
                  {APT_STATUS_LABELS[aptKey(a)] ?? a.status}
                </span>
                {aptKey(a) !== "PUBLICADO" && onUpdateAppointmentStatus && (
                  <button
                    type="button"
                    onClick={() => onUpdateAppointmentStatus(a.id, "PUBLICADO")}
                    className="w-full sm:w-auto justify-center sm:ml-auto px-2 py-1 sm:py-0.5 rounded-md text-[10px] font-bold bg-primary text-primary-foreground hover:opacity-90"
                    title="Marcar esta sessão como publicada"
                  >
                    Marcar como publicada
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </td>
    </tr>
  );
}

function isMandatory(p: Publication): boolean {
  const tags = p.tags ?? [];
  return tags.includes("obrigatoria") || tags.includes("plano-anual");
}

/** Rótulo fixo das duas categorias do plano anual (usado no painel de vínculos). */
function categoryLabelOf(categoryId?: string): string {
  if (categoryId === AV_CATEGORY_ID) return "Atividades Variadas";
  if (categoryId === PB_CATEGORY_ID) return "Programa Bilíngue";
  return categoryId ?? "";
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
  const key = normalizePublicationStatus(status) ?? status;
  const meta = DEFAULT_STATUSES.find((s) => s.value === key);
  return (
    <button
      type="button"
      onClick={onClick}
      title="Clique para alternar o status (marcar como Publicado)"
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border border-transparent transition-opacity hover:opacity-80 ${
        meta ? `${meta.bg} ${meta.color}` : "bg-muted text-muted-foreground"
      }`}
    >
      {key === "PUBLICADO" && <CheckCircle2 className="w-3 h-3 text-green-600" />}
      {meta?.label ?? key}
    </button>
  );
}

function PublicationTable({
  title,
  accentClass,
  rows,
  year,
  classes,
  onUpdateDate,
  onCycleStatus,
  onSelect,
  onUpdateAppointmentStatus,
}: {
  title: string;
  accentClass: string;
  rows: RowData[];
  year: number;
  classes?: SchoolClass[];
  onUpdateDate: (pub: Publication, dateISO: string) => void;
  onCycleStatus: (pub: Publication) => void;
  onSelect?: (pub: Publication) => void;
  onUpdateAppointmentStatus?: (appointmentId: string, status: AppointmentStatus) => Promise<void> | void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  // Publicação cuja lista de sessões vinculadas está expandida na tabela.
  const [expandedPubId, setExpandedPubId] = useState<string | null>(null);
  // Publicação selecionada para edição completa (modal) a partir da barra "Editar".
  const [editPubId, setEditPubId] = useState<string | null>(null);

  const editTarget = rows.find((r) => r.pub.id === editPubId)?.pub;

  return (
    <section className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
      <header
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-border ${accentClass}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Table2 className="w-4 h-4 shrink-0" />
          <h3 className="text-sm font-extrabold tracking-tight truncate">{title}</h3>
          <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/70 text-foreground whitespace-nowrap">
            {rows.length} {rows.length === 1 ? "publicação" : "publicações"} • {year}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-bold opacity-80 hover:opacity-100 transition-opacity shrink-0">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="flex items-center gap-1 hover:underline"
            title={collapsed ? "Estender tabela" : "Recolher tabela"}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            <span className="hidden sm:inline">{collapsed ? "Estender" : "Recolher"}</span>
          </button>
          <button
            type="button"
            disabled={!editTarget}
            onClick={() => {
              if (editTarget) onSelect?.(editTarget);
              else setEditPubId(rows[0]?.pub.id ?? null);
            }}
            className="hover:underline disabled:opacity-40 disabled:no-underline"
            title={
              editTarget
                ? "Abrir edição completa (datas, status e vínculo com sessões fotográficas)"
                : "Selecione uma linha primeiro (clique no título ou marque a caixa)"
            }
          >
            Editar
          </button>
        </div>
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
                  <th className="px-4 sm:px-5 py-2.5 font-bold">Sessões vinculadas</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const { pub, seriesName } = row;
                  const published = normalizePublicationStatus(pub.status) === "PUBLICADO";
                  const isExpanded = expandedPubId === pub.id;
                  return (
                    <React.Fragment key={pub.id}>
                      <tr
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
                              className="w-[132px] sm:w-[150px] rounded-lg border border-input bg-background px-1.5 sm:px-2 py-1 text-xs sm:text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        <td className="px-4 sm:px-5 py-2.5 whitespace-nowrap">
                          {row.linkedSessions.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setExpandedPubId(isExpanded ? null : pub.id)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
                                isExpanded
                                  ? "bg-violet-600 text-white border-violet-600"
                                  : "bg-violet-100 text-violet-700 border-violet-200 hover:bg-violet-200"
                              }`}
                              title={
                                isExpanded
                                  ? "Ocultar sessões vinculadas"
                                  : "Ver sessões fotográficas vinculadas a esta publicação"
                              }
                            >
                              <Link2 className="w-3 h-3" />
                              {row.linkedSessions.length} sessão{row.linkedSessions.length > 1 ? "ões" : ""}
                              {isExpanded ? " ▲" : " ▼"}
                            </button>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <LinkedSessionsPanel
                          row={row}
                          classes={classes}
                          onClose={() => setExpandedPubId(null)}
                          onUpdateAppointmentStatus={onUpdateAppointmentStatus}
                        />
                      )}
                    </React.Fragment>
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
  appointments,
  classes,
  onUpdateAppointmentStatus,
  editingPublicationId,
  onSetEditingPublicationId,
  onRequestRestore,
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

  // Mapa id da sessão → objeto, para exibir as sessões vinculadas na tabela.
  const aptById = useMemo(() => {
    const map = new Map<string, Appointment>();
    (appointments ?? []).forEach((a) => map.set(a.id, a));
    return map;
  }, [appointments]);

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
        linkedSessions: (pub.tags ?? [])
          .filter((t) => t.startsWith("apt:"))
          .map((t) => aptById.get(t.slice(4)))
          .filter((a): a is Appointment => !!a),
      }));

  const avRows = buildRows(AV_CATEGORY_ID);
  const pbRows = buildRows(PB_CATEGORY_ID);

  const handleUpdateDate = async (pub: Publication, dateISO: string) => {
    if (!dateISO) return;
    await onUpdatePublication(pub.id, { publicationDate: dateISO });
  };

  const STATUS_CYCLE: PublicationStatus[] = [
    "PLANEJAMENTO",
    "PRODUCAO_CONTEUDO",
    "REVISAO_APROVACAO",
    "APROVADO_PARA_PUBLICAR",
    "AGENDADO",
    "PUBLICADO",
  ];

  /** Status da publicação normalizado (banco pode trazer grafias variadas). */
  const pubKey = (pub: Publication): PublicationStatus =>
    normalizePublicationStatus(pub.status) ?? pub.status;

  /**
   * Ciclo manual do status da publicação. Além de avançar na tabela, propaga
   * o status equivalente para as sessões fotográficas vinculadas
   * ("assim vice-versa") — ex.: colocar como "Agendado" confirma as sessões
   * associadas; "Publicado" publica; "Produção de Conteúdo" volta para Editar.
   */
  const handleCycleStatus = async (pub: Publication) => {
    const current = pubKey(pub);
    let next: PublicationStatus;
    if (current === "PUBLICADO") {
      next = "PLANEJAMENTO";
    } else {
      const idx = STATUS_CYCLE.indexOf(current);
      next = idx >= 0 && idx < STATUS_CYCLE.length - 1
        ? STATUS_CYCLE[idx + 1]
        : "PRODUCAO_CONTEUDO";
    }

    // Pausa temporariamente a sincronia automática para esta publicação,
    // evitando que o hook reverta o status escolhido manualmente.
    onSetEditingPublicationId?.(pub.id);

    await onUpdatePublication(pub.id, { status: next });

    // Cascata: atualiza as sessões vinculadas com o status equivalente.
    const linkedIds = (pub.tags ?? [])
      .filter((t) => t.startsWith("apt:"))
      .map((t) => t.slice(4));
    if (onUpdateAppointmentStatus && linkedIds.length > 0) {
      const targetApt = mapPublicationStatusToAppointment(next);
      for (const id of linkedIds) {
        const apt = (appointments ?? []).find((a) => a.id === id);
        if (!apt || aptKey(apt) === targetApt) continue;
        try {
          await onUpdateAppointmentStatus(id, targetApt);
        } catch (err) {
          console.warn("Cascata publicação→sessão falhou:", err);
        }
      }
    }

    // Libera a sincronia após o snapshot refletir as mudanças.
    window.setTimeout(() => onSetEditingPublicationId?.(null), 2500);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-black text-foreground flex items-center gap-2">
            <Table2 className="w-5 h-5 shrink-0 text-blue-600" />
            <span className="truncate">Controle de Publicações</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            Publicações obrigatórias por série. Edite as datas diretamente na
            tabela e clique no status para publicar.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {onRequestRestore && (
            <button
              type="button"
              onClick={() => onRequestRestore(activeYear)}
              title="Recupera publicações obrigatórias que saíram da tabela (ex.: 5º Ano do Programa Bilíngue)"
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Restaurar publicações do plano anual</span>
              <span className="sm:hidden">Restaurar</span>
            </button>
          )}
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
      </div>

      <PublicationTable
        title={categoryNameById.get(AV_CATEGORY_ID) ?? "Atividades Variadas"}
        accentClass="bg-blue-50 dark:bg-blue-950/30"
        rows={avRows}
        year={activeYear}
        classes={classes}
        onUpdateDate={handleUpdateDate}
        onCycleStatus={handleCycleStatus}
        onSelect={onSelectPublication}
        onUpdateAppointmentStatus={onUpdateAppointmentStatus}
      />

      <PublicationTable
        title={categoryNameById.get(PB_CATEGORY_ID) ?? "Programa Bilíngue"}
        accentClass="bg-emerald-50 dark:bg-emerald-950/30"
        rows={pbRows}
        year={activeYear}
        classes={classes}
        onUpdateDate={handleUpdateDate}
        onCycleStatus={handleCycleStatus}
        onSelect={onSelectPublication}
        onUpdateAppointmentStatus={onUpdateAppointmentStatus}
      />
    </div>
  );
}
