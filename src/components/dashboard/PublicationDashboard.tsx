"use client";

import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { addMonths, eachDayOfInterval, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
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

/* ------------------------------------------------------------------ */
/* Tipos e dados (somente para visualização)                           */
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
    title: "Total de Atividades Variadas",
    value: 21,
    year: "2026",
    icon: Layers,
    iconClass: "bg-blue-50 text-blue-600",
  },
  {
    title: "Total de Programa Bilíngue",
    value: 15,
    year: "2026",
    icon: Languages,
    iconClass: "bg-indigo-50 text-indigo-600",
  },
  {
    title: "Total de Eventos Pedagógicos",
    value: 48,
    year: "2026",
    icon: GraduationCap,
    iconClass: "bg-emerald-50 text-emerald-600",
  },
  {
    title: "Total de RT Publicity",
    value: 28,
    year: "2026",
    icon: Megaphone,
    iconClass: "bg-amber-50 text-amber-600",
  },
  {
    title: "Total de Comemorações",
    value: 21,
    year: "2026",
    icon: PartyPopper,
    iconClass: "bg-pink-50 text-pink-600",
  },
];

/* ------------------------------------------------------------------ */
/* Agendamentos (somente para visualização)                            */
/* ------------------------------------------------------------------ */

type EventType = "programada" | "agendada" | "producao" | "publicada" | "atrasada";

interface ScheduleEvent {
  title: string;
  category: string;
  type: EventType;
}

const EVENT_STYLES: Record<EventType, { label: string; dot: string; chip: string }> = {
  programada: {
    label: "Programada",
    dot: "bg-indigo-500",
    chip: "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800",
  },
  agendada: {
    label: "Agendada",
    dot: "bg-sky-500",
    chip: "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800",
  },
  producao: {
    label: "Em produção",
    dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  },
  publicada: {
    label: "No ar",
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
  },
  atrasada: {
    label: "Atrasada",
    dot: "bg-red-500",
    chip: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800",
  },
};

/** Gera uma chave estável "yyyy-MM-dd" a partir de um dia do mês (evita problemas de fuso). */
const dayKey = (year: number, monthIdx: number, day: number) =>
  `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/** Mapa "yyyy-MM-dd" -> eventos, distribuído pelos meses de 2026. */
const SCHEDULE_MAP: Record<string, ScheduleEvent[]> = (() => {
  const map: Record<string, ScheduleEvent[]> = {};
  const add = (year: number, monthIdx: number, day: number, events: ScheduleEvent[]) => {
    const key = dayKey(year, monthIdx, day);
    (map[key] ??= []).push(...events);
  };

  for (let m = 0; m < 12; m++) {
    const daysInMonth = eachDayOfInterval({
      start: startOfMonth(new Date(2026, m, 1)),
      end: endOfMonth(new Date(2026, m, 1)),
    }).length;
    // datas "determinísticas" espalhadas pelo mês
    const pick = (i: number) => ((m * 7 + i * 11) % (daysInMonth - 1)) + 1;
    add(2026, m, pick(0), [
      { title: "Post — Programa Bilíngue", category: "Bilíngue", type: "programada" },
      { title: "Reels — Atividades Variadas", category: "Variadas", type: "agendada" },
    ]);
    add(2026, m, pick(3), [{ title: "Evento Pedagógico", category: "Pedagógico", type: "agendada" }]);
    add(2026, m, pick(6), [{ title: "RT Publicity", category: "Publicity", type: "producao" }]);
    add(2026, m, pick(9), [{ title: "Comemoração do mês", category: "Comemoração", type: "programada" }]);
    if (m <= 9) {
      add(2026, m, pick(2), [{ title: "Publication — No ar", category: "Publicidade", type: "publicada" }]);
    }
    if (m % 3 === 1) {
      add(2026, m, pick(5), [{ title: "Follow-up pendente", category: "Variadas", type: "atrasada" }]);
    }
  }

  // Reforço no mês atual (outubro/2026) para demonstração
  const extraOut: Array<[number, ScheduleEvent[]]> = [
    [7, [
      { title: "Carrossel — Eventos Pedagógicos", category: "Pedagógico", type: "agendada" },
      { title: "Story — Programa Bilíngue", category: "Bilíngue", type: "programada" },
    ]],
    [14, [
      { title: "RT Publicity — Campanha", category: "Publicity", type: "producao" },
      { title: "Publication — Comemoração", category: "Comemoração", type: "publicada" },
      { title: "Pauta atrasada", category: "Variadas", type: "atrasada" },
    ]],
    [15, [{ title: "Live — Atividades Variadas", category: "Variadas", type: "agendada" }]],
    [21, [{ title: "E-book — Programa Bilíngue", category: "Bilíngue", type: "programada" }]],
    [28, [
      { title: "Webinário Pedagógico", category: "Pedagógico", type: "agendada" },
      { title: "Release RT", category: "Publicity", type: "programada" },
    ]],
  ];
  for (const [day, events] of extraOut) add(2026, 9, day, events);

  return map;
})();

const getEventsForDate = (date: Date): ScheduleEvent[] =>
  SCHEDULE_MAP[dayKey(date.getFullYear(), date.getMonth(), date.getDate())] ?? [];

/* ------------------------------------------------------------------ */
/* Sub-componentes                                                     */
/* ------------------------------------------------------------------ */

function StatusCard({ card }: { card: StatusCardData }) {
  const Icon = card.icon;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              card.iconClass
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-muted-foreground">
              {card.title}
            </p>
            <p className="text-2xl font-bold leading-tight">{card.value}</p>
            <p className="truncate text-xs text-muted-foreground">
              {card.subtitle}
            </p>
          </div>
        </div>
        {card.showLink && (
          <button
            type="button"
            className="mt-2 text-xs font-medium text-primary hover:underline"
          >
            Ver lista
          </button>
        )}
      </CardContent>
    </Card>
  );
}

function CategoryCard({ card }: { card: CategoryCardData }) {
  const Icon = card.icon;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              card.iconClass
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-muted-foreground">
              {card.title}
            </p>
            <p className="text-2xl font-bold leading-tight">
              {card.value}
              <span className="ml-1 align-top text-xs font-semibold text-muted-foreground">
                {card.year}
              </span>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Calendário central (grande, com agendamentos visíveis)              */
/* ------------------------------------------------------------------ */

const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function CenterCalendar() {
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date(2026, 9)));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(0);

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
  }, [month]);

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
              Agendamentos de publicações — clique em um dia para ver os detalhes
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
              onClick={() => goToMonth(new Date(2026, 9))}
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
        {/* Legenda */}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {(Object.keys(EVENT_STYLES) as EventType[]).map((t) => (
            <span key={t} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("h-2.5 w-2.5 rounded-full", EVENT_STYLES[t].dot)} />
              {EVENT_STYLES[t].label}
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
                    {events.slice(0, 2).map((ev, i) => (
                      <span
                        key={i}
                        className={cn(
                          "flex items-center gap-1 truncate rounded border px-1 py-px text-[10px] leading-tight font-medium",
                          EVENT_STYLES[ev.type].chip
                        )}
                      >
                        <span
                          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", EVENT_STYLES[ev.type].dot)}
                        />
                        <span className="truncate">{ev.title}</span>
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
                  {selectedEvents.map((ev, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm"
                    >
                      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", EVENT_STYLES[ev.type].dot)} />
                      <span className="min-w-0 flex-1 truncate font-medium">{ev.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{ev.category}</span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                          EVENT_STYLES[ev.type].chip
                        )}
                      >
                        {EVENT_STYLES[ev.type].label}
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
  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-6">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">
            Painel de Publicações
          </h1>
          <p className="text-sm text-muted-foreground">
            Visão geral das publicações cadastradas em 2026
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          {/* Lateral esquerda — cards de status */}
          <aside className="order-2 space-y-3 xl:order-1 xl:col-span-3 2xl:col-span-2">
            <h2 className="px-1 text-sm font-semibold text-muted-foreground">
              Status
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2">
              {STATUS_CARDS.map((card) => (
                <StatusCard key={card.title} card={card} />
              ))}
            </div>
          </aside>

          {/* Centro — calendário grande com agendamentos */}
          <main className="order-1 min-w-0 xl:order-2 xl:col-span-6 2xl:col-span-8">
            <CenterCalendar />
          </main>

          {/* Lateral direita — totais por categoria */}
          <aside className="order-3 space-y-3 xl:col-span-3 2xl:col-span-2">
            <h2 className="px-1 text-sm font-semibold text-muted-foreground">
              Totais por Categoria
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2">
              {CATEGORY_CARDS.map((card) => (
                <CategoryCard key={card.title} card={card} />
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
