"use client";

import React, { useState } from "react";
import { X, Clock, Check } from "lucide-react";
import { ProductionDeadline, Series, Category } from "@/lib/calendar/types";

interface DeadlinesModalProps {
  isOpen: boolean;
  onClose: () => void;
  deadlines: ProductionDeadline[];
  series: Series[];
  categories: Category[];
}

export function DeadlinesModal({
  isOpen,
  onClose,
  deadlines,
  series,
  categories,
}: DeadlinesModalProps) {
  const [selectedCat, setSelectedCat] = useState<string>("ATIVIDADES_VARIADAS");

  if (!isOpen) return null;

  const currentDeadlines = deadlines.filter((d) => d.categoryId === selectedCat);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Tabela Oficial de Prazos de Produção (Dias Úteis)
            </h3>
            <p className="text-xs text-muted-foreground">
              Configurações de antecedência necessária para produção de cada série escolar.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Switcher */}
        <div className="p-3 border-b border-border bg-muted/10 flex items-center gap-2">
          <button
            onClick={() => setSelectedCat("ATIVIDADES_VARIADAS")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedCat === "ATIVIDADES_VARIADAS"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-background border border-border text-foreground hover:bg-accent"
            }`}
          >
            Atividades Variadas
          </button>
          <button
            onClick={() => setSelectedCat("PROGRAMA_BILINGUE")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedCat === "PROGRAMA_BILINGUE"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-background border border-border text-foreground hover:bg-accent"
            }`}
          >
            Programa Bilíngue
          </button>
        </div>

        {/* Deadlines Table */}
        <div className="p-4 max-h-[420px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border text-muted-foreground uppercase font-bold">
                <th className="py-2 px-3">Série Escolar</th>
                <th className="py-2 px-3 text-center">Prazo (Dias Úteis)</th>
                <th className="py-2 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {series.map((s) => {
                const deadline = currentDeadlines.find((d) => d.seriesId === s.id);
                return (
                  <tr key={s.id} className="hover:bg-muted/30">
                    <td className="py-2.5 px-3 font-semibold text-foreground">{s.name}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-primary text-sm">
                      {deadline ? `${deadline.daysBefore} dias` : "7 dias (padrão)"}
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-600 font-medium">
                      <span className="inline-flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px]">
                        <Check className="w-3 h-3" /> Ativo
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
