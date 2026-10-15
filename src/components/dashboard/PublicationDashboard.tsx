"use client";

import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { addMonths, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FileText,
  CalendarDays,
  ClipboardList,
  CalendarCheck,
  Palette,
  SearchCheck,
  BadgeCheck,
  Rocket,
  AlertTriangle,
  Flame,
  Layers,
  Languages,
  GraduationCap,
  Megaphone,
  PartyPopper,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { usePublications, useCategories } from "@/lib/calendar/hooks";
import type { Publication, Category, PublicationStatus } from "@/lib/calendar/types";

/* ------------------------------------------------------------------ */
/* Tipos e dados dos cards                                             */
/* ------------------------------------------------------------------ */

interface StatusCardData {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  showLink: boolean;
}

interface CategoryCardData {
  categoryId: string;
  title: string;
  value: number;
  year: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
}

const STATUS_CARDS: StatusCardData[] = [
  {
    title: "Total de Publicações",
    value: 112,
    subtitle: "Cadastradas em 2026",
    icon: FileText,
    iconClass: "bg-blue-50 text-blue-600",
    showLink: true,
  },
  {
    title: "Este Mês",
    value: 27,
    subtitle: "Programadas no mês",
    icon: CalendarDays,
    iconClass: "bg-indigo-50 text-indigo-600",
    showLink: true,
  },
  {
    title: "Em Planejamento",
    value: 5,
    subtitle: "Aguardando produção",
    icon: ClipboardList,
    iconClass: "bg-slate-100 text-slate-600",
    showLink: true,
  },
  {
    title: "Agendados",
    value: 18,
    subtitle: "Com data confirmada",
    icon: CalendarCheck,
    iconClass: "bg-sky-50 text-sky-600",
    showLink: true,
  },
  {
    title: "Em Produção",
    value: 4,
    subtitle: "Sendo produzidos",
    icon: Palette,
    iconClass: "bg-amber-50 text-amber-600",
    showLink: true,
  },
  {
    title: "Revisão / Aprovação",
    value: 0,
    subtitle: "Em conferência",
    icon: SearchCheck,
    iconClass: "bg-violet-50 text-violet-600",
    showLink: false,
  },
  {
    title: "Aprovados p/ Publicar",
    value: 0,
    subtitle: "Prontos para ir ao ar",
    icon: BadgeCheck,
    iconClass: "bg-teal-50 text-teal-600",
    showLink: false,
  },
  {
    title: "Concluídas / No Ar",
    value: 85,
    subtitle: "Publicadas com sucesso",
    icon: Rocket,
    iconClass: "bg-emerald-50 text-emerald-600",
    showLink: true,
  },
  {
    title: "Atrasadas",
    value: 7,
    subtitle: "Atenção necessária",
    icon: AlertTriangle,
    iconClass: "bg-red-50 text-red-600",
    showLink: true,
  },
  {
    title: "Próximos 7 Dias",
    value: 9,
    subtitle: "Datas iminentes",
    icon: Flame,
    iconClass: "bg-orange-50 text-orange-600",
    showLink: true,
  },
];

const CATEGORY_CARDS: CategoryCardData[] = [
  {
    categoryId: "ATIVIDADES_VARIADAS",
    title: "Total de Atividades Variadas",
    value: 21,
    year: "2026",
    icon: Layers,
    iconClass: "bg-blue-50 text-blue-600",
  },
  {
    categoryId: "PROGRAMA_BILINGUE",
    title: "Total de Programa Bilíngue",
    value: 15,
    year: "2026",
    icon: Languages,
    iconClass: "bg-indigo-50 text-indigo-600",
  },
  {
    categoryId: "EVENTOS_PEDAGOGICOS",
    title: "Total de Eventos Pedagógicos",
    value: 48,
    year: "2026",
    icon: GraduationCap,
    iconClass: "bg-emerald-50 text-emerald-600",
  },
  {
    categoryId: "RT_PUBLICITY",
    title: "Total de RT Publicity",
    value: 28,
    year: "2026",
    icon: Megaphone,
    iconClass: "bg-amber-50 text-amber-600",
  },
  {
    categoryId: "FERIADOS",
    title: "Total de Comemorações",
    value: 21,
    year: "2026",
    icon: PartyPopper,
    iconClass: "bg-pink-50 text-pink-600",
  },
];

/* ------------------------------------------------------------------ */
/* Agendamentos REAIS — vêm do banco de dados (Firestore/local)        */
/* ------------------------------------------------------------------ */

/** Chave "yyyy-MM-dd" a partir de um dia do mês (evita problemas de fuso). */
const dayKey = (year: number, monthIdx: number, day: number) =>
  `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/**
 * Agrupa publicações vindas do banco por data de publicação ("publicationDate"),
 * exatamente como exibido no calendário principal do sistema.
 */
function buildScheduleMap(publications: Publication[]): Record<string, Publication[]> {
  const map: Record<string, Publication[]> = {};
  for (const p of publications) {
    if (p.isDeleted || !p.publicationDate) continue;
    (map[p.publicationDate] ??= []).push(p);
  }
  Object.values(map).forEach((list) =>
    list.sort((a, b) => a.title.localeCompare(b.title))
  );
  return map;
}

/** Chips por status real da publicação (mesma paleta do calendário principal). */
const STATUS_CHIP_STYLES: Record<PublicationStatus, string> = {
  PLANEJAMENTO: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/60 dark:text-slate-300 dark:border-slate-700",
  BRIEFING: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800",
  PRODUCAO_CONTEUDO: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  DESIGN_ARTE: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800",
  REVISAO_APROVACAO: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800",
  APROVADO_PARA_PUBLICAR: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800",
  AGENDADO: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
  PUBLICADO: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
  ATRASADO: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800",
  CANCELADO: "bg-zinc-100 text-zinc-600 border-zinc-300 line-through dark:bg-zinc-900/60 dark:text-zinc-400 dark:border-zinc-700",
  PAUSADO: "bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950/60 dark:text-yellow-300 dark:border-yellow-800",
  REPROGRAMADO: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800",
};

const STATUS_DOT_COLORS: Record<PublicationStatus, string> = {
  PLANEJAMENTO: "#64748b",
  BRIEFING: "#0ea5e9",
  PRODUCAO_CONTEUDO: "#f59e0b",
  DESIGN_ARTE: "#6366f1",
  REVISAO_APROVACAO: "#9333ea",
  APROVADO_PARA_PUBLICAR: "#14b8a6",
  AGENDADO: "#3b82f6",
  PUBLICADO: "#10b981",
  ATRASADO: "#ef4444",
  CANCELADO: "#a1a1aa",
  PAUSADO: "#ca8a04",
  REPROGRAMADO: "#f97316",
};

const STATUS_LABELS: Record<PublicationStatus, string> = {
  PLANEJAMENTO: "Planejamento",
  BRIEFING: "Briefing",
  PRODUCAO_CONTEUDO: "Produção de Conteúdo",
  DESIGN_ARTE: "Design & Arte",
  REVISAO_APROVACAO: "Revisão / Aprovação",
  APROVADO_PARA_PUBLICAR: "Aprovado p/ publicar",
  AGENDADO: "Agendado",
  PUBLICADO: "Publicado",
  ATRASADO: "Atrasado",
  CANCELADO: "Cancelado",
  PAUSADO: "Pausado",
  REPROGRAMADO: "Reprogramado",
};

const LEGEND_STATUSES: PublicationStatus[] = [
  "PLANEJAMENTO",
  "PRODUCAO_CONTEUDO",
  "REVISAO_APROVACAO",
  "AGENDADO",
  "PUBLICADO",
  "ATRASADO",
];

/* ------------------------------------------------------------------ */
/* Sub-componentes                                                     */
/* ------------------------------------------------------------------ */

function StatusCard({ card }: { card: StatusCardData }) {
  const Icon = card.icon;
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3">
        {/* Cabeçalho do card: título em linha própria, nunca sobreposto ao ícone */}
        <div className="mb-1.5 flex items-center gap-2">
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
              card.iconClass
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <h3 className="min-w-0 break-words text-[13px] font-semibold leading-snug text-muted-foreground">
            {card.title}
          </h3>
        </div>
        {/* Valor + subtítulo empilhados, com quebra de palavra controlada */}
        <div className="pl-9">
          <p className="break-words text-xl font-bold leading-tight tabular-nums">
            {card.value}
          </p>
          <p className="break-words text-[11px] leading-snug text-muted-foreground">
            {card.subtitle}
          </p>
          {card.showLink && (
            <button
              type="button"
              className="mt-1.5 text-[11px] font-medium text-primary hover:underline"
            >
              Ver lista
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CategoryCard({ card }: { card: CategoryCardData }) {
  const Icon = card.icon;
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3">
        <div className="mb-1.5 flex items-center gap-2">
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
              card.iconClass
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <h3 className="min-w-0 break-words text-[13px] font-semibold leading-snug text-muted-foreground">
            {card.title}
          </h3>
        </div>
        <p className="break-words pl-9 text-xl font-bold leading-tight tabular-nums">
          {card.value}
          <span className="ml-1 align-top text-[10px] font-semibold text-muted-foreground">
            {card.year}
          </span>
        </p>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Calendário central (grande, com agendamentos visíveis)              */
/* ------------------------------------------------------------------ */

const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function CenterCalendar({
  publications,
  categories,
  loading,
}: {
  publications: Publication[];
  categories: Category[];
  loading: boolean;
}) {
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(0);

  // Mapa de agendamentos REAIS: yyyy-MM-dd -> publicações do banco
  const scheduleMap = useMemo(() => buildScheduleMap(publications), [publications]);

  const getEventsForDate = (date: Date): Publication[] =>
    scheduleMap[dayKey(date.getFullYear(), date.getMonth(), date.getDate())] ?? [];

  const categoryNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of categories) m[c.id] = c.name;
    return m;
  }, [categories]);

  // Largura real da grade -> células quadradas grandes e responsivas
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setGridWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cellSize = Math.max(84, Math.min(150, Math.floor((gridWidth || 840) / 7) - 6));

  const days = useMemo(() => {
    const first = startOfMonth(month);
    const startWd = first.getDay(); // 0 = domingo
    const last = endOfMonth(month);
    const totalCells = Math.ceil((startWd + last.getDate()) / 7) * 7;
    return Array.from({ length: totalCells }, (_, i) => {
      const dayNum = i - startWd + 1;
      const inMonth = dayNum >= 1 && dayNum <= last.getDate();
      const date = inMonth ? new Date(month.getFullYear(), month.getMonth(), dayNum) : null;
      return { dayNum, inMonth, date, events: date ? getEventsForDate(date) : [] };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, scheduleMap]);

  const selectedEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  const goToMonth = (m: Date) => {
    setMonth(startOfMonth(m));
    setSelectedDate(null);
  };

  const isTodayCell = (d: Date | null) => {
    if (!d) return false;
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg font-semibold capitalize">
              {format(month, "MMMM yyyy", { locale: ptBR })}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {loading
                ? "Carregando agendamentos do banco de dados..."
                : "Agendamentos do banco de dados — clique em um dia para ver os detalhes"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Mês anterior"
              className={cn(buttonVariants({ variant: "outline", size: "icon" }))}
              onClick={() => goToMonth(subMonths(month, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              onClick={() => goToMonth(new Date())}
            >
              Hoje
            </button>
            <button
              type="button"
              aria-label="Próximo mês"
              className={cn(buttonVariants({ variant: "outline", size: "icon" }))}
              onClick={() => goToMonth(addMonths(month, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        {/* Legenda de status reais */}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {LEGEND_STATUSES.map((s) => (
            <span key={s} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: STATUS_DOT_COLORS[s] }}
              />
              {STATUS_LABELS[s]}
            </span>
          ))}
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        {/* Grade do calendário */}
        <div ref={gridRef} className="w-full">
          <div className="mb-1 grid grid-cols-7 gap-1.5">
            {WEEKDAYS_SHORT.map((wd) => (
              <div
                key={wd}
                className="py-1 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {wd}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {days.map(({ dayNum, inMonth, date, events }, idx) => {
              const isSelected =
                !!selectedDate &&
                !!date &&
                date.toDateString() === selectedDate.toDateString();
              const hasEvents = events.length > 0;
              return inMonth && date ? (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedDate(date)}
                  style={{ height: cellSize }}
                  className={cn(
                    "flex flex-col overflow-hidden rounded-lg border p-1.5 text-left transition-colors",
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-card hover:bg-accent/60",
                    hasEvents && !isSelected && "bg-accent/30"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                      isTodayCell(date)
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground"
                    )}
                  >
                    {dayNum}
                  </span>
                  <span className="mt-1 flex flex-col gap-0.5 overflow-hidden">
                    {events.slice(0, 2).map((pub) => (
                      <span
                        key={pub.id}
                        className={cn(
                          "flex items-center gap-1 truncate rounded border px-1 py-px text-[10px] leading-tight font-medium",
                          STATUS_CHIP_STYLES[pub.status]
                        )}
                      >
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: STATUS_DOT_COLORS[pub.status] }}
                        />
                        <span className="truncate">{pub.title}</span>
                      </span>
                    ))}
                    {events.length > 2 && (
                      <span className="pl-1 text-[10px] font-medium text-muted-foreground">
                        +{events.length - 2} mais
                      </span>
                    )}
                  </span>
                </button>
              ) : (
                <div
                  key={idx}
                  style={{ height: cellSize }}
                  className="rounded-lg border border-dashed border-border/40 bg-muted/20"
                />
              );
            })}
          </div>
        </div>

        {/* Painel de detalhes do dia selecionado */}
        <div className="rounded-lg border bg-muted/30 p-3">
          {selectedDate ? (
            <>
              <p className="mb-2 text-sm font-semibold capitalize">
                {format(selectedDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
              {selectedEvents.length > 0 ? (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {selectedEvents.map((pub) => (
                    <li
                      key={pub.id}
                      className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: STATUS_DOT_COLORS[pub.status] }}
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">{pub.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {categoryNameById[pub.categoryId] ?? pub.categoryId}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                          STATUS_CHIP_STYLES[pub.status]
                        )}
                      >
                        {STATUS_LABELS[pub.status]}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum agendamento nesta data.</p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Selecione um dia no calendário para visualizar os agendamentos.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Painel                                                              */
/* ------------------------------------------------------------------ */

export function PublicationDashboard() {
  const { publications, loading } = usePublications();
  const { categories } = useCategories();

  const stats = useMemo(() => {
    const yearPrefix = "2026-";
    const active = publications.filter(
      (p) => !p.isDeleted && p.publicationDate?.startsWith(yearPrefix)
    );
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const currentMonthStr = `${yearPrefix}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const next7 = new Date(now);
    next7.setDate(next7.getDate() + 7);
    const next7Str = `${next7.getFullYear()}-${String(next7.getMonth() + 1).padStart(2, "0")}-${String(next7.getDate()).padStart(2, "0")}`;

    const byCategory: Record<string, number> = {};
    for (const p of active) {
      byCategory[p.categoryId] = (byCategory[p.categoryId] ?? 0) + 1;
    }

    return {
      total: active.length,
      thisMonth: active.filter((p) => p.publicationDate.startsWith(currentMonthStr)).length,
      planned: active.filter((p) => p.status === "PLANEJAMENTO").length,
      scheduled: active.filter((p) => p.status === "AGENDADO").length,
      inProduction: active.filter(
        (p) => p.status === "PRODUCAO_CONTEUDO" || p.status === "DESIGN_ARTE" || p.status === "BRIEFING"
      ).length,
      inReview: active.filter((p) => p.status === "REVISAO_APROVACAO").length,
      approved: active.filter((p) => p.status === "APROVADO_PARA_PUBLICAR").length,
      completed: active.filter((p) => p.status === "PUBLICADO").length,
      delayed: active.filter(
        (p) => p.status === "ATRASADO" || (p.status !== "PUBLICADO" && p.publicationDate < todayStr)
      ).length,
      next7Days: active.filter(
        (p) => p.publicationDate >= todayStr && p.publicationDate <= next7Str
      ).length,
      byCategory,
    };
  }, [publications]);

  const statusCards: StatusCardData[] = [
    { title: "Total de Publicações", value: stats.total, subtitle: "Cadastradas em 2026", icon: FileText, iconClass: "bg-blue-50 text-blue-600", showLink: true },
    { title: "Este Mês", value: stats.thisMonth, subtitle: "Programadas no mês", icon: CalendarDays, iconClass: "bg-indigo-50 text-indigo-600", showLink: true },
    { title: "Em Planejamento", value: stats.planned, subtitle: "Aguardando produção", icon: ClipboardList, iconClass: "bg-slate-100 text-slate-600", showLink: true },
    { title: "Agendados", value: stats.scheduled, subtitle: "Com data confirmada", icon: CalendarCheck, iconClass: "bg-sky-50 text-sky-600", showLink: true },
    { title: "Em Produção", value: stats.inProduction, subtitle: "Sendo produzidos", icon: Palette, iconClass: "bg-amber-50 text-amber-600", showLink: true },
    { title: "Revisão / Aprovação", value: stats.inReview, subtitle: "Em conferência", icon: SearchCheck, iconClass: "bg-violet-50 text-violet-600", showLink: stats.inReview > 0 },
    { title: "Aprovados p/ Publicar", value: stats.approved, subtitle: "Prontos para ir ao ar", icon: BadgeCheck, iconClass: "bg-teal-50 text-teal-600", showLink: stats.approved > 0 },
    { title: "Concluídas / No Ar", value: stats.completed, subtitle: "Publicadas com sucesso", icon: Rocket, iconClass: "bg-emerald-50 text-emerald-600", showLink: true },
    { title: "Atrasadas", value: stats.delayed, subtitle: "Atenção necessária", icon: AlertTriangle, iconClass: "bg-red-50 text-red-600", showLink: true },
    { title: "Próximos 7 Dias", value: stats.next7Days, subtitle: "Datas iminentes", icon: Flame, iconClass: "bg-orange-50 text-orange-600", showLink: true },
  ];

  const categoryCards: CategoryCardData[] = CATEGORY_CARDS.map((c) => ({
    ...c,
    value: stats.byCategory[c.categoryId] ?? 0,
  }));

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-6">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">
            Painel de Publicações
          </h1>
          <p className="text-sm text-muted-foreground">
            Visão geral das publicações cadastradas em 2026 — dados sincronizados com o banco
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          {/* Lateral esquerda — cards de status */}
          <aside className="order-2 space-y-3 xl:order-1 xl:col-span-3 2xl:col-span-2">
            <h2 className="px-1 text-sm font-semibold text-muted-foreground">
              Status
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2">
              {statusCards.map((card) => (
                <StatusCard key={card.title} card={card} />
              ))}
            </div>
          </aside>

          {/* Centro — calendário grande com agendamentos do banco */}
          <main className="order-1 min-w-0 xl:order-2 xl:col-span-6 2xl:col-span-8">
            <CenterCalendar
              publications={publications}
              categories={categories}
              loading={loading}
            />
          </main>

          {/* Lateral direita — totais por categoria */}
          <aside className="order-3 space-y-3 xl:col-span-3 2xl:col-span-2">
            <h2 className="px-1 text-sm font-semibold text-muted-foreground">
              Totais por Categoria
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2">
              {categoryCards.map((card) => (
                <CategoryCard key={card.title} card={card} />
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
