"use client";

import * as React from "react";
import { useState } from "react";
import { DayPicker } from "react-day-picker";
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
/* Calendário central (somente visualização)                           */
/* ------------------------------------------------------------------ */

function CenterCalendar() {
  const [selected, setSelected] = useState<Date | undefined>(new Date());

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Calendário de Publicações — 2026
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Visualização das datas cadastradas
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 items-center justify-center">
        <DayPicker
          mode="single"
          selected={selected}
          onSelect={setSelected}
          month={new Date(2026, 9)} /* outubro de 2026 */
          locale={ptBR}
          fixedWeeks
          classNames={{
            months: "w-full",
            month: "w-full space-y-4",
            month_caption: "flex justify-center relative items-center h-9",
            caption_label: "text-sm font-medium capitalize",
            nav: "space-x-1 flex items-center",
            button_previous: cn(
              buttonVariants({ variant: "outline" }),
              "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute left-2 inset-y-0 my-auto z-20"
            ),
            button_next: cn(
              buttonVariants({ variant: "outline" }),
              "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-2 inset-y-0 my-auto z-20"
            ),
            month_grid: "w-full border-collapse space-y-1",
            weekdays: "flex",
            weekday:
              "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
            week: "flex w-full mt-2",
            day: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
            day_button: cn(
              buttonVariants({ variant: "ghost" }),
              "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
            ),
            selected:
              "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
            today: "bg-accent text-accent-foreground",
            outside:
              "day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
            disabled: "text-muted-foreground opacity-50",
          }}
        />
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

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Lateral esquerda — cards de status */}
          <aside className="order-2 space-y-3 lg:order-1 lg:col-span-3">
            <h2 className="px-1 text-sm font-semibold text-muted-foreground">
              Status
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {STATUS_CARDS.map((card) => (
                <StatusCard key={card.title} card={card} />
              ))}
            </div>
          </aside>

          {/* Centro — calendário */}
          <main className="order-1 lg:order-2 lg:col-span-6">
            <CenterCalendar />
          </main>

          {/* Lateral direita — totais por categoria */}
          <aside className="order-3 space-y-3 lg:col-span-3">
            <h2 className="px-1 text-sm font-semibold text-muted-foreground">
              Totais por Categoria
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
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
