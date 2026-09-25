"use client";

import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Sparkles,
  Filter,
} from "lucide-react";
import { Publication, Holiday, Category } from "@/lib/calendar/types";
import {
  getDaysInMonthGrid,
  getMonthName,
  formatDateForDisplay,
  formatDateToISO,
} from "@/lib/calendar/utils";

interface CalendarViewProps {
  publications: Publication[];
  holidays: Holiday[];
  categories: Category[];
  selectedYear: number;
  selectedMonth: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
  onSelectPublication: (pub: Publication) => void;
  onCreateOnDate: (dateStr: string) => void;
  onOpenDeadlines: () => void;
  onOpenHolidays: () => void;
}

export function CalendarView({
  publications,
  holidays,
  categories,
  selectedYear,
  selectedMonth,
  onYearChange,
  onMonthChange,
  onSelectPublication,
  onCreateOnDate,
  onOpenDeadlines,
  onOpenHolidays,
}: CalendarViewProps) {
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("ALL");

  const daysGrid = getDaysInMonthGrid(selectedYear, selectedMonth, holidays);

  const prevMonth = () => {
    if (selectedMonth === 0) {
      onMonthChange(11);
      onYearChange(selectedYear - 1);
    } else {
      onMonthChange(selectedMonth - 1);
    }
  };

  const nextMonth = () => {
    if (selectedMonth === 11) {
      onMonthChange(0);
      onYearChange(selectedYear + 1);
    } else {
      onMonthChange(selectedMonth + 1);
    }
  };

  const goToToday = () => {
    const today = new Date();
    onYearChange(today.getFullYear());
    onMonthChange(today.getMonth());
  };

  const filteredPublications = publications.filter((p) => {
    if (selectedCategoryFilter === "ALL") return true;
    return p.categoryId === selectedCategoryFilter;
  });

  const getCategoryColor = (catId: string) => {
    return categories.find((c) => c.id === catId)?.color || "#6B7280";
  };

  const weekDayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      {/* Calendar Header & Controls */}
      <div className="p-4 border-b border-border bg-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-background rounded-lg border border-border p-0.5">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-md hover:bg-accent text-foreground transition-colors"
              title="Mês Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-md hover:bg-accent text-foreground transition-colors"
              title="Próximo Mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-xl font-bold text-foreground">
            {getMonthName(selectedMonth)} {selectedYear}
          </h2>

          <button
            onClick={goToToday}
            className="px-2.5 py-1 text-xs font-semibold rounded-md border border-border bg-background hover:bg-accent text-foreground transition-colors"
          >
            Hoje
          </button>
        </div>

        {/* Quick links & Year Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => onYearChange(parseInt(e.target.value, 10))}
            className="h-8 px-2.5 text-xs font-semibold rounded-md border border-border bg-background text-foreground focus:ring-1 focus:ring-primary"
          >
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
            <option value={2027}>2027</option>
          </select>

          <button
            onClick={onOpenDeadlines}
            className="px-2.5 py-1 text-xs font-medium rounded-md border border-border bg-background hover:bg-accent text-foreground transition-colors"
          >
            Prazos de Produção
          </button>

          <button
            onClick={onOpenHolidays}
            className="px-2.5 py-1 text-xs font-medium rounded-md border border-border bg-background hover:bg-accent text-foreground transition-colors"
          >
            Feriados ({holidays.length})
          </button>
        </div>
      </div>

      {/* Categories Filter Bar */}
      <div className="px-4 py-2.5 bg-background border-b border-border flex items-center gap-2 overflow-x-auto text-xs">
        <span className="font-semibold text-muted-foreground flex items-center gap-1 shrink-0">
          <Filter className="w-3.5 h-3.5" /> Categorias:
        </span>
        <button
          onClick={() => setSelectedCategoryFilter("ALL")}
          className={`px-2.5 py-1 rounded-full font-medium transition-all ${
            selectedCategoryFilter === "ALL"
              ? "bg-primary text-primary-foreground font-semibold"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          Todas
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategoryFilter(cat.id)}
            className={`px-2.5 py-1 rounded-full font-medium transition-all flex items-center gap-1.5 ${
              selectedCategoryFilter === cat.id
                ? "bg-foreground text-background font-semibold shadow-xs"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: cat.color }}
            />
            {cat.name}
          </button>
        ))}
      </div>

      {/* Week Day Header */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider py-2">
        {weekDayLabels.map((day, idx) => (
          <div
            key={day}
            className={idx === 0 || idx === 6 ? "text-rose-500/80" : ""}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Month Days Grid */}
      <div className="grid grid-cols-7 divide-x divide-y divide-border bg-muted/10">
        {daysGrid.map((cell) => {
          const dayPubs = filteredPublications.filter(
            (p) => p.publicationDate === cell.date
          );
          const maxVisible = 3;
          const visiblePubs = dayPubs.slice(0, maxVisible);
          const extraCount = dayPubs.length - maxVisible;

          return (
            <div
              key={cell.date}
              className={`min-h-[110px] md:min-h-[125px] p-1.5 flex flex-col justify-between transition-colors group relative ${
                !cell.isCurrentMonth
                  ? "bg-muted/30 opacity-60"
                  : cell.isWeekend
                  ? "bg-muted/15"
                  : "bg-card"
              } ${cell.isToday ? "ring-2 ring-inset ring-primary" : ""}`}
            >
              {/* Day Number and Badges */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-xs font-bold rounded-md px-1.5 py-0.5 ${
                    cell.isToday
                      ? "bg-primary text-primary-foreground"
                      : cell.holiday
                      ? "bg-rose-100 text-rose-700 font-extrabold"
                      : cell.isWeekend
                      ? "text-muted-foreground/70"
                      : "text-foreground"
                  }`}
                >
                  {cell.dayNumber}
                </span>

                {cell.holiday && (
                  <span
                    className="text-[10px] font-bold text-rose-600 truncate max-w-[80px] bg-rose-50 px-1 rounded border border-rose-200"
                    title={cell.holiday.name}
                  >
                    {cell.holiday.name}
                  </span>
                )}

                {/* Hover Add Button */}
                <button
                  onClick={() => onCreateOnDate(cell.date)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-primary/20 text-primary"
                  title="Adicionar publicação neste dia"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Publications List in Cell */}
              <div className="flex-1 space-y-1 overflow-hidden">
                {visiblePubs.map((pub) => {
                  const catColor = getCategoryColor(pub.categoryId);
                  return (
                    <div
                      key={pub.id}
                      onClick={() => onSelectPublication(pub)}
                      className="text-[11px] p-1 rounded font-medium border border-border/60 bg-background hover:scale-[1.02] cursor-pointer transition-all truncate flex items-center gap-1 shadow-2xs"
                      style={{ borderLeftWidth: "3px", borderLeftColor: catColor }}
                      title={`${pub.title} (${pub.status})`}
                    >
                      <span className="truncate">{pub.title}</span>
                    </div>
                  );
                })}

                {extraCount > 0 && (
                  <div
                    onClick={() => onCreateOnDate(cell.date)}
                    className="text-[10px] text-primary font-bold cursor-pointer hover:underline pl-1"
                  >
                    +{extraCount} mais...
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
