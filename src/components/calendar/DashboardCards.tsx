"use client";

import React, { useState } from "react";
import {
  FileText,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flame,
  CalendarCheck,
  Palette,
  SearchCheck,
  BadgeCheck,
  ArrowRight,
  Trash2,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Languages,
  GraduationCap,
  Megaphone,
  X,
} from "lucide-react";
import { DashboardStats, Publication, Category } from "@/lib/calendar/types";
import { DEFAULT_STATUSES, DEFAULT_PRIORITIES, DEFAULT_SERIES } from "@/lib/calendar/constants";
import { formatDateForDisplay } from "@/lib/calendar/utils";

const SERIES_NAME: Record<string, string> = Object.fromEntries(
  DEFAULT_SERIES.map((s) => [s.id, s.name])
);

/** Título exibido: publicações obrigatórias geradas não têm título — mostra a série */
export function getPublicationLabel(pub: Publication, categoryName?: string): string {
  if (pub.title && pub.title.trim()) return pub.title;
  const seriesName = pub.seriesId ? SERIES_NAME[pub.seriesId] : undefined;
  if (seriesName) return `(Sem título) ${seriesName}${categoryName ? " • " + categoryName : ""}`;
  return "(Sem título)";
}

const STATS_CARDS_HIDDEN_KEY = "calendar-stats-cards-hidden";

interface DashboardCardsProps {
  stats: DashboardStats;
  /** Ano ativo do calendário — os cards contam apenas publicações deste ano. */
  year?: number;
  upcoming: Publication[];
  categories: Category[];
  onSelectPublication: (pub: Publication) => void;
  onNewPublication: () => void;
  /** Controle externo de visibilidade dos cards (opcional). */
  collapsed?: boolean;
  onToggleCollapsed?: (collapsed: boolean) => void;
}

export function DashboardCards({
  stats,
  year,
  upcoming,
  categories,
  onSelectPublication,
  onNewPublication,
  collapsed: collapsedProp,
  onToggleCollapsed,
}: DashboardCardsProps) {
  // Estado interno (persistido em localStorage) usado quando não há controle externo.
  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(STATS_CARDS_HIDDEN_KEY) === "1";
    } catch {
      return false;
    }
  });

  const isCollapsed = collapsedProp ?? internalCollapsed;

  const toggleCollapsed = () => {
    const next = !isCollapsed;
    if (onToggleCollapsed) {
      onToggleCollapsed(next);
    } else {
      setInternalCollapsed(next);
      try {
        window.localStorage.setItem(STATS_CARDS_HIDDEN_KEY, next ? "1" : "0");
      } catch {
        /* ignore storage errors */
      }
    }
  };
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
      key: "total" as const,
      title: "Total de Publicações",
      value: stats.total,
      subtitle: year ? `Cadastradas em ${year}` : "Cadastradas no sistema",
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-50 border-blue-200",
    },
    {
      key: "thisMonth" as const,
      title: "Este Mês",
      value: stats.thisMonth,
      subtitle: "Programadas no mês",
      icon: Calendar,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50 border-indigo-200",
    },
    {
      key: "planned" as const,
      title: "Em Planejamento",
      value: stats.planned,
      subtitle: "Aguardando produção",
      icon: Clock,
      color: "text-amber-600",
      bgColor: "bg-amber-50 border-amber-200",
    },
    {
      key: "scheduled" as const,
      title: "Agendados",
      value: stats.scheduled ?? 0,
      subtitle: "Com data confirmada",
      icon: CalendarCheck,
      color: "text-sky-600",
      bgColor: "bg-sky-50 border-sky-200",
    },
    {
      key: "inProduction" as const,
      title: "Em Produção",
      value: stats.inProduction ?? 0,
      subtitle: "Sendo produzidos",
      icon: Palette,
      color: "text-violet-600",
      bgColor: "bg-violet-50 border-violet-200",
    },
    {
      key: "inReview" as const,
      title: "Revisão / Aprovação",
      value: stats.inReview ?? 0,
      subtitle: "Em conferência",
      icon: SearchCheck,
      color: "text-teal-600",
      bgColor: "bg-teal-50 border-teal-200",
    },
    {
      key: "approved" as const,
      title: "Aprovados p/ Publicar",
      value: stats.approved ?? 0,
      subtitle: "Prontos para ir ao ar",
      icon: BadgeCheck,
      color: "text-lime-600",
      bgColor: "bg-lime-50 border-lime-200",
    },
    {
      key: "completed" as const,
      title: "Concluídas / No Ar",
      value: stats.completed,
      subtitle: "Publicadas com sucesso",
      icon: CheckCircle2,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50 border-emerald-200",
    },
    {
      key: "delayed" as const,
      title: "Atrasadas",
      value: stats.delayed,
      subtitle: "Atenção necessária",
      icon: AlertTriangle,
      color: "text-rose-600",
      bgColor: "bg-rose-50 border-rose-200",
    },
    {
      key: "next7Days" as const,
      title: "Próximos 7 Dias",
      value: stats.next7Days,
      subtitle: "Datas iminentes",
      icon: Flame,
      color: "text-orange-600",
      bgColor: "bg-orange-50 border-orange-200",
    },
  ];

  // ---------------------------------------------------------------------
  // Contagem de publicações POR CATEGORIA — somente o ano selecionado.
  // (stats.byCategory já é calculado restrito ao ano ativo do calendário)
  // ---------------------------------------------------------------------
  const cat = (id: string) => stats.byCategory?.[id] ?? 0;
  const categoryCards = [
    {
      id: "ATIVIDADES_VARIADAS",
      fallbackName: "Atividades Variadas",
      value: cat("ATIVIDADES_VARIADAS"),
      icon: FileText,
      color: "#4ECDC4",
    },
    {
      id: "PROGRAMA_BILINGUE",
      fallbackName: "Programa Bilíngue",
      value: cat("PROGRAMA_BILINGUE"),
      icon: Languages,
      color: "#9B59B6",
    },
    {
      id: "EVENTOS_PEDAGOGICOS",
      fallbackName: "Eventos Pedagógicos",
      value: cat("EVENTOS_PEDAGOGICOS"),
      icon: GraduationCap,
      color: "#F39C12",
    },
    {
      id: "RT_PUBLICITY",
      fallbackName: "RT Publicity",
      value: cat("RT_PUBLICITY"),
      icon: Megaphone,
      color: "#3853B6",
    },
  ];

  // ---------------------------------------------------------------------
  // Clique nos cards: abre a lista das publicações que compõem a contagem
  // (ex.: clicar em "Atrasadas" abre a lista de todas as atrasadas).
  // ---------------------------------------------------------------------
  const [openList, setOpenList] = useState<{
    title: string;
    subtitle?: string;
    items: Publication[];
  } | null>(null);

  const openStatusList = (key: (typeof cardItems)[number]["key"], title: string) => {
    const items = stats.lists?.[key] ?? [];
    if (items.length === 0) return;
    setOpenList({ title, subtitle: year ? `Ano ${year}` : undefined, items });
  };

  const openCategoryList = (id: string, name: string) => {
    const items = stats.lists?.byCategoryList?.[id] ?? [];
    if (items.length === 0) return;
    setOpenList({
      title: `Total de ${name}`,
      subtitle: year ? `Ano ${year}` : undefined,
      items,
    });
  };

  return (
    <div className="space-y-6">
      {/* Barra de controle: ocultar/exibir os cards de resumo */}
      <div className="flex items-center justify-between">
        {isCollapsed ? (
          <p className="text-xs text-muted-foreground">
            Cards de resumo ocultos
          </p>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-expanded={!isCollapsed}
          title={isCollapsed ? "Mostrar cards de resumo" : "Ocultar cards de resumo"}
        >
          {isCollapsed ? (
            <>
              <Eye className="w-3.5 h-3.5" />
              Mostrar cards
            </>
          ) : (
            <>
              <EyeOff className="w-3.5 h-3.5" />
              Ocultar cards
            </>
          )}
        </button>
      </div>

      {/* Cards Grid — 10 cards em fluxo responsivo (2/3/5 colunas).
          Clicar em um card abre a lista das publicações daquela contagem. */}
      {!isCollapsed && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {cardItems.map((card, idx) => {
          const Icon = card.icon;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => openStatusList(card.key, card.title)}
              disabled={card.value === 0}
              title={
                card.value > 0
                  ? `Ver lista: ${card.title}`
                  : "Nenhuma publicação nesta contagem"
              }
              className={`text-left p-3.5 rounded-xl border bg-card transition-all hover:shadow-sm disabled:cursor-default ${card.bgColor}`}
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
              {card.value > 0 && (
                <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-primary/80">
                  <Eye className="w-3 h-3" /> Ver lista
                </p>
              )}
            </button>
          );
        })}
        </div>
      )}

      {/* Contagem por categoria — somente o ano selecionado.
          Clique abre a lista de publicações da categoria no ano. */}
      {!isCollapsed && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {categoryCards.map((c) => {
            const Icon = c.icon;
            const name =
              categories.find((catItem) => catItem.id === c.id)?.name ?? c.fallbackName;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => openCategoryList(c.id, name)}
                disabled={c.value === 0}
                title={
                  c.value > 0
                    ? `Ver lista: Total de ${name}`
                    : "Nenhuma publicação desta categoria no ano"
                }
                className="text-left flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card transition-all hover:shadow-sm disabled:cursor-default"
              >
                <span
                  className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
                  style={{ backgroundColor: `${c.color}1A`, color: c.color }}
                >
                  <Icon className="w-[18px] h-[18px]" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground truncate">
                    Total de {name}
                  </p>
                  <p className="text-xl font-bold tracking-tight text-foreground leading-tight">
                    {c.value}
                    <span className="ml-1.5 text-[11px] font-semibold text-muted-foreground">
                      {year ?? ""}
                    </span>
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Modal com a lista de publicações da contagem clicada */}
      {openList && (
        <StatsListModal
          title={openList.title}
          subtitle={openList.subtitle}
          publications={openList.items}
          categories={categories}
          onClose={() => setOpenList(null)}
          onSelectPublication={(pub) => {
            setOpenList(null);
            onSelectPublication(pub);
          }}
        />
      )}
    </div>
  );
}

/**
 * Modal listagem do dashboard: exibido ao clicar em um card de contagem
 * (ex.: "Atrasadas" → todas as publicações atrasadas do ano selecionado).
 * Cada linha mostra data, título, categoria e status; clicar na linha abre
 * a edição completa da publicação.
 */
function StatsListModal({
  title,
  subtitle,
  publications,
  categories,
  onClose,
  onSelectPublication,
}: {
  title: string;
  subtitle?: string;
  publications: Publication[];
  categories: Category[];
  onClose: () => void;
  onSelectPublication: (pub: Publication) => void;
}) {
  const categoryName = (catId: string) =>
    categories.find((c) => c.id === catId)?.name || catId;
  const categoryColor = (catId: string) =>
    categories.find((c) => c.id === catId)?.color || "#6B7280";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-3xl max-h-[80vh] flex flex-col rounded-2xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-base font-black text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground">
              {publications.length}{" "}
              {publications.length === 1 ? "publicação" : "publicações"}
              {subtitle ? ` • ${subtitle}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {publications.map((pub) => (
            <button
              key={pub.id}
              type="button"
              onClick={() => onSelectPublication(pub)}
              className="w-full text-left p-3 rounded-lg border border-border/80 bg-background/60 hover:bg-accent/40 hover:border-border transition-all flex items-center justify-between gap-3"
              style={{ borderLeftWidth: "4px", borderLeftColor: categoryColor(pub.categoryId) }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">
                  {getPublicationLabel(pub, categoryName(pub.categoryId))}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {categoryName(pub.categoryId)}
                  {pub.plannedDate ? ` • Produção até ${formatDateForDisplay(pub.plannedDate)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold text-foreground tabular-nums whitespace-nowrap">
                  {formatDateForDisplay(pub.publicationDate)}
                </span>
                {getStatusBadgeStatic(pub.status)}
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Badge de status estático (usado no modal de listagem do dashboard). */
function getStatusBadgeStatic(status: string) {
  const s = DEFAULT_STATUSES.find((item) => item.value === status);
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${s?.bg || "bg-gray-100"} ${
        s?.color || "text-gray-700"
      }`}
    >
      {s?.label || status}
    </span>
  );
}

export function UpcomingPublicationsList({
  upcoming,
  allPublications = [],
  categories,
  onSelectPublication,
  onNewPublication,
  onDeletePublication,
  onStatusChange,
  collapsed = false,
  onToggleCollapsed,
}: {
  upcoming: Publication[];
  allPublications?: Publication[];
  categories: Category[];
  onSelectPublication: (pub: Publication) => void;
  onNewPublication: () => void;
  onDeletePublication?: (id: string) => Promise<void>;
  onStatusChange?: (id: string, status: string) => Promise<void> | void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const displayed = showAll ? allPublications : upcoming;

  const handleMarkAsPublished = async (
    e: React.MouseEvent,
    pub: Publication
  ) => {
    e.stopPropagation();
    if (!onStatusChange || pub.status === "PUBLICADO" || updatingId === pub.id)
      return;
    setUpdatingId(pub.id);
    try {
      await onStatusChange(pub.id, "PUBLICADO");
    } catch (err) {
      console.error("Error updating publication status:", err);
    } finally {
      setUpdatingId(null);
    }
  };

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

  // Painel recolhido: mostra apenas uma barra fina com botão para estender,
  // permitindo que o calendário ocupe todo o espaço disponível.
  if (collapsed && onToggleCollapsed) {
    return (
      <div className="rounded-xl border border-border bg-card p-2 shadow-xs flex flex-col items-center justify-start gap-2 h-full min-h-[120px]">
        <button
          onClick={onToggleCollapsed}
          title="Estender lista de publicações"
          className="w-full flex flex-col items-center gap-1.5 py-2 px-1 rounded-lg text-primary hover:bg-accent/60 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <Calendar className="w-4 h-4 opacity-60" />
        </button>
        <p className="text-[10px] font-semibold text-muted-foreground [writing-mode:vertical-lr] rotate-180 whitespace-nowrap">
          Próximas Publicações ({upcoming.length})
        </p>
      </div>
    );
  }

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
        <div className="flex items-center gap-2">
          <button
            onClick={onNewPublication}
            className="text-xs font-semibold text-primary hover:underline"
          >
            + Adicionar
          </button>
          {onToggleCollapsed && (
            <button
              onClick={onToggleCollapsed}
              title="Recolher lista (calendário ocupa todo o espaço)"
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {displayed.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
          <Calendar className="w-8 h-8 stroke-1 mb-2 opacity-40" />
          <p className="text-sm">
            {showAll
              ? "Nenhuma publicação cadastrada"
              : "Nenhuma publicação futura agendada"}
          </p>
          <button
            onClick={onNewPublication}
            className="mt-2 text-xs font-medium text-primary hover:underline"
          >
            Cadastrar primeira publicação
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-2.5 overflow-y-auto max-h-[460px] pr-1">
          {displayed.map((pub) => {
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
                    {getPublicationLabel(pub, getCategoryName(pub.categoryId))}
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
                  {onStatusChange && pub.status !== "PUBLICADO" ? (
                    <button
                      onClick={(e) => handleMarkAsPublished(e, pub)}
                      disabled={updatingId === pub.id}
                      title="Clique para marcar como Publicado"
                      className={`group/status cursor-pointer ${
                        updatingId === pub.id ? "opacity-50" : ""
                      }`}
                    >
                      {getStatusBadge(pub.status)}
                    </button>
                  ) : (
                    getStatusBadge(pub.status)
                  )}
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

          <button
            onClick={() => setShowAll((v) => !v)}
            className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            {showAll ? (
              <>
                <EyeOff className="w-3.5 h-3.5" /> Ver apenas as próximas
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" /> Ver todas ({allPublications.length})
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}
