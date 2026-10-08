"use client";

import React, { useState } from "react";
import { X, Plus, Trash2, Calendar, Check, AlertCircle } from "lucide-react";
import { Holiday } from "@/lib/calendar/types";
import { formatDateForDisplay } from "@/lib/calendar/utils";

interface HolidaysModalProps {
  isOpen: boolean;
  onClose: () => void;
  holidays: Holiday[];
  /** Ano ativo do calendário — título e filtro da lista de feriados. */
  year?: number;
  onCreateHoliday: (h: Omit<Holiday, "id">) => Promise<string>;
  onDeleteHoliday: (id: string) => Promise<void>;
}

export function HolidaysModal({
  isOpen,
  onClose,
  holidays,
  year,
  onCreateHoliday,
  onDeleteHoliday,
}: HolidaysModalProps) {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] = useState<"NACIONAL" | "ESCOLAR" | "FACULTATIVO">("ESCOLAR");
  const [recurring, setRecurring] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingHolidayId, setDeletingHolidayId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !date) return;
    setIsSubmitting(true);
    try {
      await onCreateHoliday({
        name,
        date,
        type,
        recurring,
        year: parseInt(date.split("-")[0], 10),
      });
      setName("");
      setDate("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = (id: string) => {
    setDeletingHolidayId(null);
    onDeleteHoliday(id).catch((err) => {
      console.error("Error deleting holiday:", err);
    });
  };

  /** Feriados exibidos: somente o ano selecionado (ou todos, se não informado). */
  const activeYear = year ?? new Date().getFullYear();
  const visibleHolidays = holidays.filter((h) => {
    const hYear = h.year ?? Number(h.date?.slice(0, 4));
    return hYear === activeYear;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Feriados &amp; Datas comemorativas escolares ({activeYear})
            </h3>
            <p className="text-xs text-muted-foreground">
              Feriados nacionais do Brasil e de São Paulo Capital gerados
              automaticamente + recessos cadastrados. Dias não-úteis usados no
              cálculo de produção do ano selecionado.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add Holiday Form */}
        <form onSubmit={handleAdd} className="p-4 border-b border-border bg-muted/10 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do feriado ou recesso"
              className="h-9 px-2.5 text-xs rounded-lg border border-border bg-background text-foreground"
            />
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 px-2.5 text-xs rounded-lg border border-border bg-background text-foreground"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="h-8 px-2 text-xs rounded-lg border border-border bg-background text-foreground"
              >
                <option value="ESCOLAR">Data Comemorativa</option>
                <option value="FACULTATIVO">Ponto Facultativo</option>
                <option value="NACIONAL">Feriado Nacional</option>
              </select>

              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={recurring}
                  onChange={(e) => setRecurring(e.target.checked)}
                  className="rounded text-primary"
                />
                Recorrente anual
              </label>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-1 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </button>
          </div>
        </form>

        {/* List of holidays */}
        <div className="p-4 max-h-[380px] overflow-y-auto divide-y divide-border/60">
          {visibleHolidays.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Nenhum feriado cadastrado.
            </div>
          ) : (
            visibleHolidays.map((h) => (
              <div key={h.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-foreground">{h.name}</span>
                  <span className="ml-2 text-[11px] text-muted-foreground">
                    {formatDateForDisplay(h.date)}
                  </span>
                  <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                    {h.type}
                  </span>
                </div>

                {deletingHolidayId === h.id ? (
                  <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 px-2 py-0.5 rounded text-[11px]">
                    <span className="text-rose-700 dark:text-rose-300 font-semibold">Excluir?</span>
                    <button
                      disabled={isDeleting}
                      onClick={() => handleConfirmDelete(h.id)}
                      className="px-1.5 py-0.5 bg-rose-600 text-white rounded font-bold hover:bg-rose-700"
                    >
                      {isDeleting ? "..." : "Sim"}
                    </button>
                    <button
                      disabled={isDeleting}
                      onClick={() => setDeletingHolidayId(null)}
                      className="px-1.5 py-0.5 bg-background border border-border text-foreground rounded font-medium"
                    >
                      Não
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeletingHolidayId(h.id)}
                    className="p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                    title="Excluir feriado"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
