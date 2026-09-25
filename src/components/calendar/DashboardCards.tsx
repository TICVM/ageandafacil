"use client";

import React, { useState } from "react";
import {
  FileText,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ArrowRight,
  Trash2,
} from "lucide-react";
import { DashboardStats, Publication, Category } from "@/lib/calendar/types";
import { DEFAULT_STATUSES, DEFAULT_PRIORITIES } from "@/lib/calendar/constants";
import { formatDateForDisplay } from "@/lib/calendar/utils";

interface DashboardCardsProps {
  stats: DashboardStats;
  upcoming: Publication[];
  categories: Category[];
  onSelectPublication: (pub: Publication) => void;
  onNewPublication: () => void;
}

export function DashboardCards({
  stats,
  upcoming,
  categories,
  onSelectPublication,
  onNewPublication,
}: DashboardCardsProps) {
  const getCategoryColor = (catId: string) => {
    return categories.find((c) => c.id === catId)?.color || "#6B7280";
  };

  const getCategoryName = (catId: string) => {
    return categories.find((c) => c.id === catId)?.name || catId;
  };

  const getStatusBadge = (status: string) => {
    const s = DEFAULT_STATUSES.find((item) => item.value === status);
    return (
      <span
        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s?.bg || "bg-gray-100"} ${
          s?.color || "text-gray-700"
        }`}
      >
        {s?.label || status}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const p = DEFAULT_PRIORITIES.find((item) => item.value === priority);
    return (
      <span
        className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
          p?.bg || "bg-gray-100"
        } ${p?.color || "text-gray-700"}`}
      >
        {p?.label || priority}
      </span>
    );
  };

  const cardItems = [
    {
      title: "Total de Publicações",
      value: stats.total,
      subtitle: "Cadastradas no sistema",
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-50 border-blue-200",
    },
    {
      title: "Este Mês",
      value: stats.thisMonth,
      subtitle: "Programadas no mês",
      icon: Calendar,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50 border-indigo-200",
    },
    {
      title: "Em Planejamento",
      value: stats.planned,
      subtitle: "Aguardando produção",
      icon: Clock,
      color: "text-amber-600",
      bgColor: "bg-amber-50 border-amber-200",
    },
    {
      title: "Concluídas / No Ar",
      value: stats.completed,
      subtitle: "Publicadas com sucesso",
      icon: CheckCircle2,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50 border-emerald-200",
    },
    {
      title: "Atrasadas",
      value: stats.delayed,
      subtitle: "Atenção necessária",
      icon: AlertTriangle,
      color: "text-rose-600",
      bgColor: "bg-rose-50 border-rose-200",
    },
    {
      title: "Próximos 7 Dias",
      value: stats.next7Days,
      subtitle: "Datas iminentes",
      icon: Flame,
      color: "text-orange-600",
      bgColor: "bg-orange-50 border-orange-200",
    },
  ];

  return (
    <div className="space-y-6">
      {/* 6 Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cardItems.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className={`p-3.5 rounded-xl border bg-card transition-all hover:shadow-sm ${card.bgColor}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground line-clamp-1">
                  {card.title}
                </span>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {card.value}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                {card.subtitle}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function UpcomingPublicationsList({
  upcoming,
  categories,
  onSelectPublication,
  onNewPublication,
  onDeletePublication,
}: {
  upcoming: Publication[];
  categories: Category[];
  onSelectPublication: (pub: Publication) => void;
  onNewPublication: () => void;
  onDeletePublication?: (id: string) => Promise<void>;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const getCategoryColor = (catId: string) => {
    return categories.find((c) => c.id === catId)?.color || "#6B7280";
  };

  const getCategoryName = (catId: string) => {
    return categories.find((c) => c.id === catId)?.name || catId;
  };

  const getStatusBadge = (status: string) => {
    const s = DEFAULT_STATUSES.find((item) => item.value === status);
    return (
      <span
        className={`px-2 py-0.5 rounded-full text-xs font-medium ${s?.bg || "bg-gray-100"} ${
          s?.color || "text-gray-700"
        }`}
      >
        {s?.label || status}
      </span>
    );
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-primary" />
            Próximas Publicações
          </h3>
          <p className="text-xs text-muted-foreground">
            Cronograma editorial agendado
          </p>
        </div>
        <button
          onClick={onNewPublication}
          className="text-xs font-semibold text-primary hover:underline"
        >
          + Adicionar
        </button>
      </div>

      {upcoming.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
          <Calendar className="w-8 h-8 stroke-1 mb-2 opacity-40" />
          <p className="text-sm">Nenhuma publicação agendada</p>
          <button
            onClick={onNewPublication}
            className="mt-2 text-xs font-medium text-primary hover:underline"
          >
            Cadastrar primeira publicação
          </button>
        </div>
      ) : (
        <div className="space-y-2.5 overflow-y-auto max-h-[460px] pr-1">
          {upcoming.map((pub) => {
            const catColor = getCategoryColor(pub.categoryId);
            return (
              <div
                key={pub.id}
                className="group relative p-3 rounded-lg border border-border/80 bg-background/60 hover:bg-accent/40 hover:border-border transition-all space-y-1.5"
                style={{ borderLeftWidth: "4px", borderLeftColor: catColor }}
              >
                <div className="flex items-start justify-between gap-2">
                  <h4
                    onClick={() => onSelectPublication(pub)}
                    className="text-sm font-semibold text-foreground hover:text-primary transition-colors line-clamp-1 cursor-pointer flex-1"
                  >
                    {pub.title}
                  </h4>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] font-bold text-muted-foreground whitespace-nowrap">
                      {formatDateForDisplay(pub.publicationDate)}
                    </span>
                    {onDeletePublication && (
                      deletingId === pub.id ? (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 px-1.5 py-0.5 rounded text-[10px]"
                        >
                          <button
                            onClick={() => {
                              const pubId = pub.id;
                              setDeletingId(null);
                              onDeletePublication(pubId).catch((err) => {
                                console.error("Error deleting pub:", err);
                              });
                            }}
                            className="bg-rose-600 text-white px-1.5 py-0.5 rounded font-bold hover:bg-rose-700"
                          >
                            Excluir
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="text-muted-foreground hover:text-foreground px-1"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingId(pub.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-50"
                          title="Excluir publicação"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div
                  onClick={() => onSelectPublication(pub)}
                  className="flex items-center justify-between text-xs text-muted-foreground cursor-pointer"
                >
                  <span className="font-medium text-foreground/80 line-clamp-1">
                    {getCategoryName(pub.categoryId)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {getStatusBadge(pub.status)}
                  </div>
                </div>

                {pub.plannedDate && (
                  <div
                    onClick={() => onSelectPublication(pub)}
                    className="flex items-center justify-between text-[11px] text-muted-foreground/90 pt-0.5 border-t border-border/40 cursor-pointer"
                  >
                    <span>Prazo produção:</span>
                    <span className="font-medium text-amber-700">
                      Até {formatDateForDisplay(pub.plannedDate)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
