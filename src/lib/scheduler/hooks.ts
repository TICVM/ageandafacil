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
import {
  Appointment,
  AppointmentStatus,
  PhotoLocation,
  SchoolClass,
  SchoolSegment,
  AvailableTimeSlot,
  ScheduleBlock,
  AppSettings,
} from "./types";
import {
  SAMPLE_APPOINTMENTS,
  DEFAULT_LOCATIONS,
  DEFAULT_CLASSES,
  DEFAULT_SEGMENTS,
  DEFAULT_TIME_SLOTS,
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
  const [locations, setLocations] = useState<PhotoLocation[]>(DEFAULT_LOCATIONS);
  const [classes, setClasses] = useState<SchoolClass[]>(DEFAULT_CLASSES);
  const [segments, setSegments] = useState<SchoolSegment[]>(DEFAULT_SEGMENTS);
  // Dados usados pelo "Agendar Sessão Fotográfica" para ficar IDÊNTICO à
  // página pública de reserva (/reserva): horários configuráveis do banco
  // (available_time_slots), bloqueios de agenda (schedule_blocks) e
  // configurações de antecedência mínima (app_settings/general).
  const [timeSlots, setTimeSlots] = useState<AvailableTimeSlot[]>([]);
  const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlock[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Load school classes/segments from the Firestore "school_classes" and
  // "school_segments" collections (managed in Admin > Turmas e Segmentos),
  // keeping DEFAULT_CLASSES/DEFAULT_SEGMENTS only as a fallback while offline
  // or when the collections are empty. Without this, sessions booked through
  // other screens store class IDs that don't exist in the hardcoded list and
  // the turma cannot be resolved on the cards.
  useEffect(() => {
    let unsubClasses: (() => void) | undefined;
    let unsubSegments: (() => void) | undefined;
    try {
      unsubClasses = onSnapshot(
        collection(db, "school_classes"),
        (snap) => {
          if (snap.empty) {
            setClasses(DEFAULT_CLASSES);
            return;
          }
          const list: SchoolClass[] = [];
          snap.forEach((d) => {
            const data = d.data() as {
              name?: string;
              schoolSegmentId?: string;
              order?: number;
              isActive?: boolean;
            };
            if (data.isActive === false) return;
            list.push({
              id: d.id,
              name: data.name ?? "",
              segmentId: data.schoolSegmentId ?? "",
              order: data.order ?? 0,
            });
          });
          list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          setClasses(list);
        },
        (err) => {
          console.warn("school_classes listener fallback:", err);
          setClasses(DEFAULT_CLASSES);
        }
      );
      unsubSegments = onSnapshot(
        collection(db, "school_segments"),
        (snap) => {
          if (snap.empty) {
            setSegments(DEFAULT_SEGMENTS);
            return;
          }
          const list: SchoolSegment[] = [];
          snap.forEach((d) => {
            const data = d.data() as { name?: string; unit?: string; isActive?: boolean };
            if (data.isActive === false) return;
            list.push({ id: d.id, name: data.name ?? "", unit: data.unit });
          });
          setSegments(list);
        },
        (err) => {
          console.warn("school_segments listener fallback:", err);
          setSegments(DEFAULT_SEGMENTS);
        }
      );
    } catch {
      setClasses(DEFAULT_CLASSES);
      setSegments(DEFAULT_SEGMENTS);
    }
    return () => {
      if (unsubClasses) unsubClasses();
      if (unsubSegments) unsubSegments();
    };
  }, []);

  // Load photo locations from the Firestore "photo_locations" collection
  // (managed in Admin > Locais de Foto), keeping DEFAULT_LOCATIONS only as a
  // fallback while offline / when the collection is empty.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      const colRef = collection(db, "photo_locations");
      unsubscribe = onSnapshot(
        colRef,
        (snap) => {
          if (snap.empty) {
            setLocations(DEFAULT_LOCATIONS);
            return;
          }
          const list: PhotoLocation[] = [];
          snap.forEach((d) => {
            const data = d.data() as Omit<PhotoLocation, "id">;
            list.push({
              id: d.id,
              name: data.name ?? "",
              description: data.description ?? "",
              color: data.color,
              isActive: data.isActive !== false,
              unit: data.unit,
              requiresIdentifier: data.requiresIdentifier,
            });
          });
          // Only show active locations in the booking flow/list filters.
          setLocations(list.filter((l) => l.isActive));
        },
        (err) => {
          console.warn("photo_locations listener fallback:", err);
          setLocations(DEFAULT_LOCATIONS);
        }
      );
    } catch {
      setLocations(DEFAULT_LOCATIONS);
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Horários configuráveis, bloqueios de agenda e configurações de
  // antecedência — MESMAS coleções lidas pela página /reserva, para que o
  // modal "Agendar Sessão Fotográfica" ofereça exatamente as mesmas opções.
  useEffect(() => {
    let unsubSlots: (() => void) | undefined;
    let unsubBlocks: (() => void) | undefined;
    let unsubSettings: (() => void) | undefined;
    try {
      unsubSlots = onSnapshot(
        collection(db, "available_time_slots"),
        (snap) => {
          const list: AvailableTimeSlot[] = [];
          snap.forEach((d) => {
            const data = d.data() as Omit<AvailableTimeSlot, "id">;
            if (data.isActive === false) return;
            list.push({
              id: d.id,
              dayOfWeek: String(data.dayOfWeek ?? ""),
              startTime: data.startTime ?? "",
              durationMinutes: data.durationMinutes || 60,
              subject: data.subject ?? null,
              schoolSegmentId: data.schoolSegmentId ?? null,
              schoolClassId: data.schoolClassId ?? null,
              isActive: true,
            });
          });
          setTimeSlots(list);
        },
        (err) => console.warn("available_time_slots listener:", err)
      );
      unsubBlocks = onSnapshot(
        collection(db, "schedule_blocks"),
        (snap) => {
          const list: ScheduleBlock[] = [];
          snap.forEach((d) => {
            const data = d.data() as Omit<ScheduleBlock, "id">;
            list.push({ id: d.id, ...data });
          });
          setScheduleBlocks(list);
        },
        (err) => console.warn("schedule_blocks listener:", err)
      );
      unsubSettings = onSnapshot(
        doc(db, "app_settings", "general"),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as AppSettings;
            setAppSettings({
              minAdvanceBookingDays: data.minAdvanceBookingDays ?? 1,
              minAdvanceBookingHours: data.minAdvanceBookingHours ?? 0,
            });
          }
        },
        (err) => console.warn("app_settings listener:", err)
      );
    } catch (err) {
      console.warn("booking config listeners fallback:", err);
    }
    return () => {
      if (unsubSlots) unsubSlots();
      if (unsubBlocks) unsubBlocks();
      if (unsubSettings) unsubSettings();
    };
  }, []);

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
          userId: data.teacherId || "user-1",
          userName,
          action: "CRIACAO",
          details: `Agendamento criado para a turma ${data.className}.`,
        },
      ],
    };

    // 1. Optimistic local persistence (immediate, never blocked by rate limit)
    saveCustomAppointment(newAppointment);
    setAppointments((prev) => [newAppointment, ...prev]);

    // 2. Fire-and-forget sync to Firestore with timeout.
    //    Campos gravados em "appointments" — mesmo schema da página /reserva
    //    (schoolClassId, teacherId, teacherName, photoLocationId,
    //    locationIdentifier, appointmentDate, startTime, endTime, subject,
    //    status, observations, history, createdAt) para não haver divergência
    //    entre os dois fluxos de agendamento.
    try {
      const docPromise = addDoc(collection(db, "appointments"), {
        schoolClassId: data.schoolClassId,
        className: data.className,
        teacherId: data.teacherId,
        teacherName: data.teacherName,
        photoLocationId: data.photoLocationId,
        locationName: data.locationName,
        locationIdentifier: data.locationIdentifier || null,
        appointmentDate: data.appointmentDate,
        startTime: data.startTime,
        endTime: data.endTime,
        subject: data.subject || null,
        status: data.status,
        observations: data.observations ?? "",
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
    timeSlots,
    scheduleBlocks,
    appSettings,
    loading,
    createAppointment,
    updateStatus,
    cancelAppointment,
    deleteAppointment,
  };
}

/** Converte "HH:mm" em minutos desde 00:00 (comparação de sobreposição). */
const timeToMin = (t: string): number => {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Horários disponíveis para um dia/turma — MESMA lógica da página /reserva:
 *  - filtra available_time_slots pelo dia da semana e pela turma/segmento;
 *  - respeita a antecedência mínima (app_settings/general);
 *  - remove slots já ocupados por sessões (appointments) não canceladas;
 *  - remove slots que colidem com bloqueios de agenda (schedule_blocks).
 * Retorna os horários ordenados por startTime. Sem slots configurados no
 * banco, usa DEFAULT_TIME_SLOTS como fallback (modo offline).
 */
export function getAvailableBookingSlots(params: {
  configuredSlots: AvailableTimeSlot[];
  dateStr: string; // YYYY-MM-DD
  schoolClassId: string;
  classes: SchoolClass[];
  appointments: Appointment[];
  blocks: ScheduleBlock[];
  settings: AppSettings | null;
}): SlotOption[] {
  const { configuredSlots, dateStr, schoolClassId, classes, appointments, blocks, settings } = params;

  if (configuredSlots.length === 0) {
    // Fallback offline: grade fixa histórica do modal.
    return DEFAULT_TIME_SLOTS.map((s) => ({
      id: `default-${s.startTime}`,
      startTime: s.startTime,
      endTime: s.endTime,
      durationMinutes: Math.max(
        10,
        timeToMin(s.endTime) - timeToMin(s.startTime)
      ),
      subject: null,
    }));
  }

  const date = new Date(`${dateStr}T00:00:00`);
  if (isNaN(date.getTime())) return [];
  const day = date.getDay().toString();
  const now = new Date();
  const minLimit = new Date(now);
  minLimit.setDate(minLimit.getDate() + (settings?.minAdvanceBookingDays ?? 1));
  minLimit.setHours(
    minLimit.getHours() + (settings?.minAdvanceBookingHours ?? 0)
  );
  const cls = classes.find((c) => c.id === schoolClassId);

  const toOption = (s: AvailableTimeSlot): SlotOption => {
    const dur = s.durationMinutes || 60;
    const endTotal = timeToMin(s.startTime) + dur;
    const endTime = `${String(Math.floor(endTotal / 60)).padStart(2, "0")}:${String(endTotal % 60).padStart(2, "0")}`;
    return {
      id: s.id,
      startTime: s.startTime,
      endTime,
      durationMinutes: dur,
      subject: s.subject ?? null,
    };
  };

  return configuredSlots
    .filter((s) => {
      if (s.dayOfWeek !== day) return false;
      const targetMatches = s.schoolClassId
        ? s.schoolClassId === schoolClassId
        : s.schoolSegmentId
          ? s.schoolSegmentId === cls?.segmentId
          : !s.schoolClassId && !s.schoolSegmentId;
      if (!targetMatches) return false;
      const [h, m] = s.startTime.split(":").map(Number);
      const slotDT = new Date(date);
      slotDT.setHours(h, m, 0, 0);
      if (slotDT < minLimit) return false;
      const opt = toOption(s);
      if (
        appointments.some(
          (a) =>
            a.appointmentDate === dateStr &&
            a.startTime === s.startTime &&
            a.status !== "CANCELLED"
        )
      )
        return false;
      if (
        blocks.some(
          (b) =>
            b.date === dateStr &&
            timeToMin(opt.startTime) < timeToMin(b.endTime) &&
            timeToMin(opt.endTime) > timeToMin(b.startTime)
        )
      )
        return false;
      return true;
    })
    .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""))
    .map(toOption);
}

/** Slot pronto para exibição/seleção no formulário de agendamento. */
export interface SlotOption {
  id: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  subject?: string | null;
}
