"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  Publication,
  Holiday,
  Category,
  Series,
  ProductionDeadline,
  PublicationHistoryEntry,
  DashboardStats,
} from "./types";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_SERIES,
  DEFAULT_PRODUCTION_DEADLINES,
  DEFAULT_HOLIDAYS_2026,
  INITIAL_SAMPLE_PUBLICATIONS,
} from "./constants";
import { calculatePlannedDate } from "./utils";
import { listBrazilHolidays } from "./brazil-holidays";
import { saveDeletedSnapshot } from "./generate-mandatory";

const DELETED_PUBLICATIONS_KEY = "schoollens_deleted_publications_v1";
const CUSTOM_PUBLICATIONS_KEY = "schoollens_custom_publications_v1";
const DELETED_HOLIDAYS_KEY = "schoollens_deleted_holidays_v1";

function getDeletedPublicationIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DELETED_PUBLICATIONS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function recordDeletedPublicationId(id: string) {
  if (typeof window === "undefined") return;
  try {
    const current = getDeletedPublicationIds();
    current.add(id);
    localStorage.setItem(
      DELETED_PUBLICATIONS_KEY,
      JSON.stringify(Array.from(current))
    );
  } catch {}
}

/**
 * Remove o id da lista local de exclusões. Necessário para "restaurar" uma
 * publicação obrigatória do plano anual que foi excluída: enquanto o id
 * estiver nessa lista, o listener do Firestore e os dados locais a ignoram,
 * e ela nunca mais volta a aparecer no Controle de Publicações.
 */
function clearDeletedPublicationId(id: string) {
  if (typeof window === "undefined") return;
  try {
    const current = getDeletedPublicationIds();
    if (!current.has(id)) return;
    current.delete(id);
    localStorage.setItem(
      DELETED_PUBLICATIONS_KEY,
      JSON.stringify(Array.from(current))
    );
  } catch {}
}

function getCustomPublications(): Publication[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_PUBLICATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomPublication(pub: Publication) {
  if (typeof window === "undefined") return;
  try {
    const list = getCustomPublications();
    const idx = list.findIndex((p) => p.id === pub.id);
    if (idx >= 0) {
      list[idx] = pub;
    } else {
      list.unshift(pub);
    }
    localStorage.setItem(CUSTOM_PUBLICATIONS_KEY, JSON.stringify(list));
  } catch {}
}

function removeCustomPublication(id: string) {
  if (typeof window === "undefined") return;
  try {
    const list = getCustomPublications().filter((p) => p.id !== id);
    localStorage.setItem(CUSTOM_PUBLICATIONS_KEY, JSON.stringify(list));
  } catch {}
}

function getDeletedHolidayIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DELETED_HOLIDAYS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function recordDeletedHolidayId(id: string) {
  if (typeof window === "undefined") return;
  try {
    const current = getDeletedHolidayIds();
    current.add(id);
    localStorage.setItem(
      DELETED_HOLIDAYS_KEY,
      JSON.stringify(Array.from(current))
    );
  } catch {}
}

/**
 * Remove duplicatas de publicações geradas automaticamente (feriados/datas
 * comemorativas): mesma categoria + data de publicação + título. Mantém a
 * primeira ocorrência — evita que o card "Total de Feriados" conte a mesma
 * data mais de uma vez quando há cópias locais e no Firestore.
 */
function dedupeByCategoryDateTitle(list: Publication[]): Publication[] {
  const seen = new Set<string>();
  const out: Publication[] = [];
  for (const p of list) {
    const key = `${p.categoryId}|${p.publicationDate}|${(p.title ?? "").trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

export function usePublications() {
  const [publications, setPublications] = useState<Publication[]>(() => {
    const deleted = getDeletedPublicationIds();
    const custom = getCustomPublications().filter((p) => !deleted.has(p.id));
    const customIds = new Set(custom.map((c) => c.id));
    const samples = INITIAL_SAMPLE_PUBLICATIONS.filter(
      (p) => !deleted.has(p.id) && !customIds.has(p.id)
    );
    return [...custom, ...samples];
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      const pubsCol = collection(db, "publications");
      unsubscribe = onSnapshot(
        pubsCol,
        (snapshot) => {
          const deleted = getDeletedPublicationIds();
          const custom = getCustomPublications().filter((p) => !deleted.has(p.id));
          const customMap = new Map(custom.map((c) => [c.id, c]));

          if (!snapshot.empty) {
            const list: Publication[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as Publication;
              if (!deleted.has(docSnap.id) && !data.isDeleted) {
                list.push({ ...data, id: docSnap.id });
              }
            });

            const firestoreIds = new Set(list.map((p) => p.id));
            const remainingCustom = custom.filter((c) => !firestoreIds.has(c.id));
            const remainingSamples = INITIAL_SAMPLE_PUBLICATIONS.filter(
              (s) => !deleted.has(s.id) && !firestoreIds.has(s.id) && !customMap.has(s.id)
            );

            setPublications(dedupeByCategoryDateTitle([...list, ...remainingCustom, ...remainingSamples]));
          } else {
            const remainingSamples = INITIAL_SAMPLE_PUBLICATIONS.filter(
              (p) => !deleted.has(p.id) && !customMap.has(p.id)
            );
            setPublications(dedupeByCategoryDateTitle([...custom, ...remainingSamples]));
          }
          setLoading(false);
        },
        (err) => {
          console.warn("Firestore snapshot publications fallback:", err);
          const deleted = getDeletedPublicationIds();
          const custom = getCustomPublications().filter((p) => !deleted.has(p.id));
          const customIds = new Set(custom.map((c) => c.id));
          const samples = INITIAL_SAMPLE_PUBLICATIONS.filter(
            (p) => !deleted.has(p.id) && !customIds.has(p.id)
          );
          setPublications([...custom, ...samples]);
          setLoading(false);
        }
      );
    } catch (err) {
      console.warn("Error setting up publications listener:", err);
      setLoading(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const createPublication = async (
    pubData: Omit<Publication, "id" | "createdAt" | "updatedAt">,
    userName = "Usuário"
  ): Promise<string> => {
    const historyEntry: PublicationHistoryEntry = {
      id: "hist-" + Date.now(),
      timestamp: new Date().toISOString(),
      userId: "user-1",
      userName,
      action: "CRIACAO",
      details: `Publicação "${pubData.title}" criada.`,
    };

    const tempId = "pub-" + Date.now();
    const newPub: Publication = {
      ...pubData,
      id: tempId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [historyEntry],
      isDeleted: false,
    };

    // 1. Optimistic local persistence (resilient against Firestore rate limits)
    saveCustomPublication(newPub);
    setPublications((prev) => [newPub, ...prev]);

    // 2. Fire-and-forget sync to Firestore with timeout
    try {
      const docPromise = addDoc(collection(db, "publications"), {
        ...pubData,
        createdAt: newPub.createdAt,
        updatedAt: newPub.updatedAt,
        history: newPub.history,
        isDeleted: false,
        serverTime: serverTimestamp(),
      });
      const docRef = await Promise.race([
        docPromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
      ]);
      if (docRef && docRef.id) {
        const syncedPub = { ...newPub, id: docRef.id };
        removeCustomPublication(tempId);
        saveCustomPublication(syncedPub);
        setPublications((prev) =>
          prev.map((p) => (p.id === tempId ? syncedPub : p))
        );
        return docRef.id;
      }
    } catch (err) {
      console.warn("Firestore sync error or rate limit, using local item:", err);
    }

    return tempId;
  };

  const updatePublication = async (
    id: string,
    updates: Partial<Publication>,
    userName = "Usuário"
  ): Promise<void> => {
    const existing = publications.find((p) => p.id === id);
    const existingHistory = existing?.history || [];

    const historyEntry: PublicationHistoryEntry = {
      id: "hist-" + Date.now(),
      timestamp: new Date().toISOString(),
      userId: "user-1",
      userName,
      action: updates.status && updates.status !== existing?.status ? "ALTERACAO_STATUS" : "ALTERACAO",
      details: updates.status && updates.status !== existing?.status
        ? `Status alterado de "${existing?.status}" para "${updates.status}".`
        : `Publicação atualizada.`,
    };

    const fullUpdates = {
      ...updates,
      updatedAt: new Date().toISOString(),
      history: [...existingHistory, historyEntry],
    };

    const updatedPub: Publication = existing
      ? { ...existing, ...fullUpdates }
      : ({ id, ...fullUpdates } as Publication);

    // 1. Update local storage and state immediately
    saveCustomPublication(updatedPub);
    setPublications((prev) =>
      prev.map((p) => (p.id === id ? updatedPub : p))
    );

    // 2. Background Firestore update with timeout protection
    try {
      const docRef = doc(db, "publications", id);
      await Promise.race([
        updateDoc(docRef, fullUpdates),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
    } catch (err) {
      console.warn("Firestore updateDoc rate limit or fallback:", err);
    }
  };

  const deletePublication = async (id: string): Promise<void> => {
    // 0. Guarda um snapshot dos dados originais para permitir a restauração
    //    pelo modal "Restaurar publicações do plano anual" (ex.: o 5º Ano do
    //    Programa Bilíngue que saiu da tabela do Controle de Publicações).
    const deleting = publications.find((p) => p.id === id);
    if (deleting) saveDeletedSnapshot(deleting);
    // 1. Mark as deleted in local storage immediately
    recordDeletedPublicationId(id);
    removeCustomPublication(id);
    // 2. Immediately remove from local state so UI updates instantaneously
    setPublications((prev) => prev.filter((p) => p.id !== id));
    // 3. Fire Firestore delete in background with timeout protection to prevent freezing
    try {
      const docRef = doc(db, "publications", id);
      await Promise.race([
        deleteDoc(docRef),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);
    } catch (err) {
      console.warn("deleteDoc firestore fallback:", err);
    }
  };

  /**
   * Restaura uma publicação obrigatória do plano anual que saiu da tabela do
   * Controle de Publicações (ex.: excluída sem querer ao editar/alterar a
   * publicação de uma série — como o 5º Ano do Programa Bilíngue).
   *
   * - Se o documento ainda existe no Firestore mas estava na lista local de
   *   exclusões, basta removê-la: o listener volta a carregá-lo.
   * - Se o documento foi apagado definitivamente, recria a publicação com os
   *   dados originais (categoria, série, datas e tags "obrigatoria"/
   *   "plano-anual"), garantindo que ela volte a aparecer na tabela.
   */
  const restorePublication = async (
    pubData: Omit<Publication, "id"> | Publication,
    userName = "Usuário"
  ): Promise<string> => {
    const id = (pubData as Publication).id;
    if (id) clearDeletedPublicationId(id);

    const existsLocally = publications.some(
      (p) => p.id === id && !p.isDeleted
    );
    if (id && existsLocally) {
      // Documento ainda vivo — apenas "desmarca" a exclusão e sincroniza.
      await updatePublication(id, { isDeleted: false }, userName);
      return id;
    }

    const { id: _omit, history: _hist, createdAt: _c, updatedAt: _u, isDeleted: _d, ...rest } =
      pubData as Publication;
    void _omit; void _hist; void _c; void _u; void _d;
    return createPublication(
      {
        ...rest,
        // Garante que volte a ser reconhecida como obrigatória do plano anual
        // (critério de exibição na tabela do Controle de Publicações).
        tags: [
          ...new Set([
            ...(rest.tags ?? []).filter((t) => t !== "obrigatoria" && t !== "plano-anual"),
            "obrigatoria",
            "plano-anual",
          ]),
        ],
      },
      userName
    );
  };

  const duplicatePublication = async (
    sourceId: string,
    newDate: string,
    holidays: Holiday[],
    userName = "Usuário"
  ): Promise<string> => {
    const source = publications.find((p) => p.id === sourceId);
    if (!source) throw new Error("Publicação de origem não encontrada.");

    const plannedDate = calculatePlannedDate(newDate, source.productionDays || 7, holidays);

    const duplicateData: Omit<Publication, "id" | "createdAt" | "updatedAt"> = {
      title: `${source.title} (Cópia)`,
      description: source.description,
      categoryId: source.categoryId,
      seriesId: source.seriesId,
      status: "PLANEJAMENTO",
      priority: source.priority,
      publicationDate: newDate,
      plannedDate,
      productionDays: source.productionDays,
      responsibleName: source.responsibleName,
      responsibleEmail: source.responsibleEmail,
      tags: source.tags ? [...source.tags] : [],
    };

    return createPublication(duplicateData, userName);
  };

  /**
   * Estatísticas do painel do calendário SEMPRE restritas ao ano selecionado.
   * Antes as métricas consideravam todas as publicações do sistema — lançar
   * algo em 2027 inflava "Total de Publicações", "Em Planejamento",
   * "Concluídas" etc. Agora, com um ano selecionado, cada card conta apenas
   * as publicações cuja data está dentro daquele ano.
   */
  const getStats = useCallback((year = 2026): DashboardStats => {
    const yearPrefix = `${year}-`;
    const active = publications.filter(
      (p) => !p.isDeleted && p.publicationDate?.startsWith(yearPrefix)
    );
    const now = new Date();
    const currentMonthStr = String(now.getMonth() + 1).padStart(2, "0");
    const yearMonthStr = `${year}-${currentMonthStr}`;

    const next7DaysLimit = new Date();
    next7DaysLimit.setDate(next7DaysLimit.getDate() + 7);
    const next7DaysStr = next7DaysLimit.toISOString().split("T")[0];
    const todayStr = now.toISOString().split("T")[0];

    const thisMonthList = active.filter((p) => p.publicationDate.startsWith(yearMonthStr));
    const plannedList = active.filter((p) => p.status === "PLANEJAMENTO");
    const completedList = active.filter((p) => p.status === "PUBLICADO");
    const delayedList = active.filter((p) => p.status === "ATRASADO" || (p.status !== "PUBLICADO" && p.publicationDate < todayStr));
    // Status intermediários do fluxo de produção — também restritos ao ano.
    const scheduledList = active.filter((p) => p.status === "AGENDADO");
    const inProductionList = active.filter(
      (p) => p.status === "PRODUCAO_CONTEUDO" || p.status === "DESIGN_ARTE" || p.status === "BRIEFING"
    );
    const inReviewList = active.filter((p) => p.status === "REVISAO_APROVACAO");
    const approvedList = active.filter((p) => p.status === "APROVADO_PARA_PUBLICAR");
    // "Próximos 7 Dias" também não pode ultrapassar a virada do ano.
    const nextYearPrefix = `${year + 1}-`;
    const next7DaysList = active.filter(
      (p) =>
        p.publicationDate >= todayStr &&
        p.publicationDate <= next7DaysStr &&
        !p.publicationDate.startsWith(nextYearPrefix)
    );

    const thisMonth = thisMonthList.length;
    const planned = plannedList.length;
    const completed = completedList.length;
    const delayed = delayedList.length;
    const scheduled = scheduledList.length;
    const inProduction = inProductionList.length;
    const inReview = inReviewList.length;
    const approved = approvedList.length;
    const next7Days = next7DaysList.length;

    // Totais por categoria (somente o ano selecionado) + listas por categoria,
    // usadas pelo dashboard ao clicar em um card de contagem.
    const byCategory: Record<string, number> = {};
    const byCategoryList: Record<string, Publication[]> = {};
    for (const p of active) {
      byCategory[p.categoryId] = (byCategory[p.categoryId] ?? 0) + 1;
      (byCategoryList[p.categoryId] ??= []).push(p);
    }
    Object.values(byCategoryList).forEach((list) =>
      list.sort((a, b) => a.publicationDate.localeCompare(b.publicationDate))
    );
    const byDate = (a: Publication, b: Publication) =>
      a.publicationDate.localeCompare(b.publicationDate);

    return {
      total: active.length,
      thisMonth,
      planned,
      completed,
      delayed,
      next7Days,
      scheduled,
      inProduction,
      inReview,
      approved,
      byCategory,
      lists: {
        total: [...active].sort(byDate),
        thisMonth: [...thisMonthList].sort(byDate),
        planned: [...plannedList].sort(byDate),
        scheduled: [...scheduledList].sort(byDate),
        inProduction: [...inProductionList].sort(byDate),
        inReview: [...inReviewList].sort(byDate),
        approved: [...approvedList].sort(byDate),
        completed: [...completedList].sort(byDate),
        delayed: [...delayedList].sort(byDate),
        next7Days: [...next7DaysList].sort(byDate),
        byCategoryList,
      },
    };
  }, [publications]);

  return {
    publications,
    loading,
    error,
    createPublication,
    updatePublication,
    deletePublication,
    restorePublication,
    duplicatePublication,
    getStats,
  };
}

export function useHolidays(year?: number) {
  // Ano ativo do calendário — garante que o modal "Feriados & Recessos
  // Escolares" mostre os feriados (nacionais + SP) do ANO SELECIONADO,
  // mesmo quando ainda não existe nenhuma publicação naquele ano.
  const yearRef = useRef<number>(year ?? new Date().getFullYear());
  if (typeof year === "number" && year > 1970) yearRef.current = year;

  const buildList = useCallback(
    (base: Holiday[]) => {
      const deleted = getDeletedHolidayIds();
      const activeYear = yearRef.current;
      // Feriados automáticos do ANO SELECIONADO (nacionais + SP Capital +
      // datas comemorativas como Páscoa, Dia das Mães, Dia Internacional da
      // Mulher) — sempre presentes no modal "Feriados & Recessos Escolares",
      // mesmo que o banco só tenha feriados de outros anos.
      const autoForYear = listBrazilHolidays(activeYear).filter(
        (auto) => !deleted.has(auto.id)
      );
      const autoIds = new Set(autoForYear.map((a) => a.id));
      // Mantém apenas itens manuais e autos do ano ativo na base vinda do banco.
      const keptBase = base.filter(
        (h) => !h.id.startsWith("auto-") || autoIds.has(h.id)
      );
      // Autos do ano ativo têm prioridade sobre itens manuais na mesma data.
      const autoDates = new Set(autoForYear.map((a) => a.date));
      const manual = keptBase.filter(
        (h) => !(h.id.startsWith("auto-") && autoDates.has(h.date))
      );
      return [...manual, ...autoForYear].sort((a, b) =>
        a.date.localeCompare(b.date)
      );
    },
    []
  );

  const [holidays, setHolidays] = useState<Holiday[]>(() =>
    buildList(DEFAULT_HOLIDAYS_2026.filter((h) => !getDeletedHolidayIds().has(h.id)))
  );
  const [loading, setLoading] = useState(true);

  // Reage à troca de ano no calendário: injeta os feriados automáticos do novo ano.
  useEffect(() => {
    if (typeof year !== "number" || year <= 1970) return;
    yearRef.current = year;
    setHolidays((prev) => {
      const deleted = getDeletedHolidayIds();
      const withoutAuto = prev.filter((h) => !h.id.startsWith("auto-"));
      const withNewYear = buildList(withoutAuto);
      // mantém a lista estável se nada mudou
      const same =
        withNewYear.length === prev.length &&
        withNewYear.every((h, i) => h.id === prev[i]?.id);
      return same ? prev : withNewYear;
    });
  }, [year, buildList]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      const colRef = collection(db, "holidays");
      unsubscribe = onSnapshot(
        colRef,
        (snapshot) => {
          const deleted = getDeletedHolidayIds();
          if (!snapshot.empty) {
            const list: Holiday[] = [];
            snapshot.forEach((docSnap) => {
              if (!deleted.has(docSnap.id)) {
                list.push({ ...(docSnap.data() as Holiday), id: docSnap.id });
              }
            });
            const firestoreIds = new Set(list.map((h) => h.id));
            const remainingSamples = DEFAULT_HOLIDAYS_2026.filter(
              (h) => !deleted.has(h.id) && !firestoreIds.has(h.id)
            );
            setHolidays(buildList([...list, ...remainingSamples]));
          } else {
            const remaining = DEFAULT_HOLIDAYS_2026.filter((h) => !deleted.has(h.id));
            setHolidays(buildList(remaining));
          }
          setLoading(false);
        },
        (err) => {
          console.warn("Firestore holidays snapshot fallback:", err);
          setHolidays(
            buildList(DEFAULT_HOLIDAYS_2026.filter((h) => !getDeletedHolidayIds().has(h.id)))
          );
          setLoading(false);
        }
      );
    } catch {
      setLoading(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [buildList]);

  const createHoliday = async (holidayData: Omit<Holiday, "id">) => {
    try {
      const ref = await addDoc(collection(db, "holidays"), holidayData);
      return ref.id;
    } catch {
      const id = "h-" + Date.now();
      setHolidays((prev) => [...prev, { ...holidayData, id }]);
      return id;
    }
  };

  const deleteHoliday = async (id: string) => {
    recordDeletedHolidayId(id);
    setHolidays((prev) => prev.filter((h) => h.id !== id));
    try {
      await Promise.race([
        deleteDoc(doc(db, "holidays", id)),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);
    } catch (err) {
      console.warn("deleteDoc holiday fallback:", err);
    }
  };

  return { holidays, loading, createHoliday, deleteHoliday };
}

/**
 * Cores oficiais das categorias padrão. Se a cor do Firestore divergir da
 * cor definida em DEFAULT_CATEGORIES, a cor do código tem precedência —
 * isso garante que trocas de cor (ex.: RT Publicity #3853B6) apareçam
 * imediatamente para todos os usuários sem precisar editar o banco.
 */
const CATEGORY_COLORS: Record<string, string> = Object.fromEntries(
  DEFAULT_CATEGORIES.map((c) => [c.id, c.color])
);

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      const colRef = collection(db, "publication_categories");
      unsubscribe = onSnapshot(
        colRef,
        (snap) => {
          if (!snap.empty) {
            const list: Category[] = [];
            snap.forEach((d) => {
              const cat = { ...(d.data() as Category), id: d.id };
              const officialColor = CATEGORY_COLORS[cat.id];
              if (officialColor && cat.color !== officialColor) {
                cat.color = officialColor;
                // Sincroniza o documento no Firestore com a cor oficial.
                void updateDoc(doc(db, "publication_categories", cat.id), {
                  color: officialColor,
                }).catch(() => {});
              }
              list.push(cat);
            });
            setCategories(list);
          }
        },
        () => {}
      );
    } catch {}
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return { categories };
}

export function useSeries() {
  const [series] = useState<Series[]>(DEFAULT_SERIES);
  return { series };
}

export function useProductionDeadlines() {
  const [deadlines, setDeadlines] = useState<ProductionDeadline[]>(DEFAULT_PRODUCTION_DEADLINES);

  const getDeadline = useCallback((categoryId: string, seriesId?: string): number => {
    if (!seriesId) return 7;
    const match = deadlines.find(
      (d) => d.categoryId === categoryId && d.seriesId === seriesId && d.active
    );
    return match ? match.daysBefore : 7;
  }, [deadlines]);

  return { deadlines, getDeadline };
}
