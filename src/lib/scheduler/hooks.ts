"use client";

import { useState, useEffect } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { Appointment, AppointmentStatus } from "./types";
import {
  SAMPLE_APPOINTMENTS,
  DEFAULT_LOCATIONS,
  DEFAULT_CLASSES,
  DEFAULT_SEGMENTS,
} from "./constants";

const DELETED_APPOINTMENTS_KEY = "schoollens_deleted_appointments_v1";
const CUSTOM_APPOINTMENTS_KEY = "schoollens_custom_appointments_v1";

function getDeletedAppointmentIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DELETED_APPOINTMENTS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function recordDeletedAppointmentId(id: string) {
  if (typeof window === "undefined") return;
  try {
    const current = getDeletedAppointmentIds();
    current.add(id);
    localStorage.setItem(
      DELETED_APPOINTMENTS_KEY,
      JSON.stringify(Array.from(current))
    );
  } catch {}
}

function getCustomAppointments(): Appointment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_APPOINTMENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomAppointment(apt: Appointment) {
  if (typeof window === "undefined") return;
  try {
    const list = getCustomAppointments();
    const idx = list.findIndex((a) => a.id === apt.id);
    if (idx >= 0) {
      list[idx] = apt;
    } else {
      list.unshift(apt);
    }
    localStorage.setItem(CUSTOM_APPOINTMENTS_KEY, JSON.stringify(list));
  } catch {}
}

function removeCustomAppointment(id: string) {
  if (typeof window === "undefined") return;
  try {
    const list = getCustomAppointments().filter((a) => a.id !== id);
    localStorage.setItem(CUSTOM_APPOINTMENTS_KEY, JSON.stringify(list));
  } catch {}
}

export function useScheduler() {
  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    const deleted = getDeletedAppointmentIds();
    const custom = getCustomAppointments().filter((a) => !deleted.has(a.id));
    const customIds = new Set(custom.map((c) => c.id));
    const samples = SAMPLE_APPOINTMENTS.filter(
      (a) => !deleted.has(a.id) && !customIds.has(a.id)
    );
    return [...custom, ...samples];
  });
  const [locations] = useState(DEFAULT_LOCATIONS);
  const [classes] = useState(DEFAULT_CLASSES);
  const [segments] = useState(DEFAULT_SEGMENTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      const colRef = collection(db, "appointments");
      unsubscribe = onSnapshot(
        colRef,
        (snap) => {
          const deleted = getDeletedAppointmentIds();
          const custom = getCustomAppointments().filter((a) => !deleted.has(a.id));
          const customMap = new Map(custom.map((c) => [c.id, c]));

          if (!snap.empty) {
            const list: Appointment[] = [];
            snap.forEach((d) => {
              if (!deleted.has(d.id)) {
                list.push({ ...(d.data() as Appointment), id: d.id });
              }
            });
            const firestoreIds = new Set(list.map((a) => a.id));
            const remainingCustom = custom.filter((c) => !firestoreIds.has(c.id));
            const remainingSamples = SAMPLE_APPOINTMENTS.filter(
              (s) => !deleted.has(s.id) && !firestoreIds.has(s.id) && !customMap.has(s.id)
            );
            setAppointments([...list, ...remainingCustom, ...remainingSamples]);
          } else {
            const remainingSamples = SAMPLE_APPOINTMENTS.filter(
              (a) => !deleted.has(a.id) && !customMap.has(a.id)
            );
            setAppointments([...custom, ...remainingSamples]);
          }
          setLoading(false);
        },
        (err) => {
          console.warn("Appointments listener fallback:", err);
          const deleted = getDeletedAppointmentIds();
          const custom = getCustomAppointments().filter((a) => !deleted.has(a.id));
          const customIds = new Set(custom.map((c) => c.id));
          const samples = SAMPLE_APPOINTMENTS.filter(
            (a) => !deleted.has(a.id) && !customIds.has(a.id)
          );
          setAppointments([...custom, ...samples]);
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

  const createAppointment = async (
    data: Omit<Appointment, "id">,
    userName = "Professor"
  ): Promise<string> => {
    // Conflict check
    const hasConflict = appointments.some(
      (a) =>
        a.status !== "CANCELLED" &&
        a.appointmentDate === data.appointmentDate &&
        a.photoLocationId === data.photoLocationId &&
        ((data.startTime >= a.startTime && data.startTime < a.endTime) ||
          (data.endTime > a.startTime && data.endTime <= a.endTime) ||
          (data.startTime <= a.startTime && data.endTime >= a.endTime))
    );

    if (hasConflict) {
      throw new Error(
        "Conflito de horário! Já existe uma sessão agendada neste local e horário."
      );
    }

    const tempId = "app-" + Date.now();
    const newAppointment: Appointment = {
      ...data,
      id: tempId,
      history: [
        {
          timestamp: new Date().toISOString(),
          userId: "user-1",
          userName,
          action: "CRIACAO",
          details: `Agendamento criado para a turma ${data.className}.`,
        },
      ],
    };

    // 1. Optimistic local persistence (immediate, never blocked by rate limit)
    saveCustomAppointment(newAppointment);
    setAppointments((prev) => [newAppointment, ...prev]);

    // 2. Fire-and-forget sync to Firestore with timeout
    try {
      const docPromise = addDoc(collection(db, "appointments"), {
        ...data,
        history: newAppointment.history,
        createdAt: serverTimestamp(),
      });
      const docRef = await Promise.race([
        docPromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
      ]);
      if (docRef && docRef.id) {
        const syncedApp = { ...newAppointment, id: docRef.id };
        removeCustomAppointment(tempId);
        saveCustomAppointment(syncedApp);
        setAppointments((prev) =>
          prev.map((a) => (a.id === tempId ? syncedApp : a))
        );
        return docRef.id;
      }
    } catch (err) {
      console.warn("Firestore sync rate limit or fallback, kept locally:", err);
    }

    return tempId;
  };

  const updateStatus = async (
    id: string,
    status: AppointmentStatus,
    userName = "Admin"
  ) => {
    const existing = appointments.find((a) => a.id === id);
    const updated = existing ? { ...existing, status } : null;
    if (updated) {
      saveCustomAppointment(updated);
    }
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status } : a))
    );
    try {
      const docRef = doc(db, "appointments", id);
      await Promise.race([
        updateDoc(docRef, { status }),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
    } catch (err) {
      console.warn("updateStatus firestore fallback or rate limit:", err);
    }
  };

  const cancelAppointment = async (id: string, userName = "Admin") => {
    await updateStatus(id, "CANCELLED", userName);
  };

  const deleteAppointment = async (id: string): Promise<void> => {
    recordDeletedAppointmentId(id);
    removeCustomAppointment(id);
    setAppointments((prev) => prev.filter((a) => a.id !== id));
    try {
      await Promise.race([
        deleteDoc(doc(db, "appointments", id)),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);
    } catch (err) {
      console.warn("deleteAppointment firestore fallback:", err);
    }
  };

  return {
    appointments,
    locations,
    classes,
    segments,
    loading,
    createAppointment,
    updateStatus,
    cancelAppointment,
    deleteAppointment,
  };
}
