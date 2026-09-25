"use client";

import { useState, useEffect, useCallback } from "react";
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

            setPublications([...list, ...remainingCustom, ...remainingSamples]);
          } else {
            const remainingSamples = INITIAL_SAMPLE_PUBLICATIONS.filter(
              (p) => !deleted.has(p.id) && !customMap.has(p.id)
            );
            setPublications([...custom, ...remainingSamples]);
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

  const getStats = useCallback((year = 2026): DashboardStats => {
    const active = publications.filter((p) => !p.isDeleted);
    const now = new Date();
    const currentMonthStr = String(now.getMonth() + 1).padStart(2, "0");
    const yearMonthStr = `${year}-${currentMonthStr}`;

    const next7DaysLimit = new Date();
    next7DaysLimit.setDate(next7DaysLimit.getDate() + 7);
    const next7DaysStr = next7DaysLimit.toISOString().split("T")[0];
    const todayStr = now.toISOString().split("T")[0];

    const thisMonth = active.filter((p) => p.publicationDate.startsWith(yearMonthStr)).length;
    const planned = active.filter((p) => p.status === "PLANEJAMENTO").length;
    const completed = active.filter((p) => p.status === "PUBLICADO").length;
    const delayed = active.filter((p) => p.status === "ATRASADO" || (p.status !== "PUBLICADO" && p.publicationDate < todayStr)).length;
    const next7Days = active.filter((p) => p.publicationDate >= todayStr && p.publicationDate <= next7DaysStr).length;

    return {
      total: active.length,
      thisMonth,
      planned,
      completed,
      delayed,
      next7Days,
    };
  }, [publications]);

  return {
    publications,
    loading,
    error,
    createPublication,
    updatePublication,
    deletePublication,
    duplicatePublication,
    getStats,
  };
}

export function useHolidays() {
  const [holidays, setHolidays] = useState<Holiday[]>(() => {
    const deleted = getDeletedHolidayIds();
    return DEFAULT_HOLIDAYS_2026.filter((h) => !deleted.has(h.id));
  });
  const [loading, setLoading] = useState(true);

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
            setHolidays([...list, ...remainingSamples]);
          } else {
            const remaining = DEFAULT_HOLIDAYS_2026.filter((h) => !deleted.has(h.id));
            setHolidays(remaining);
          }
          setLoading(false);
        },
        (err) => {
          console.warn("Firestore holidays snapshot fallback:", err);
          const deleted = getDeletedHolidayIds();
          setHolidays(DEFAULT_HOLIDAYS_2026.filter((h) => !deleted.has(h.id)));
          setLoading(false);
        }
      );
    } catch {
      setLoading(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

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
            snap.forEach((d) => list.push({ ...(d.data() as Category), id: d.id }));
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
