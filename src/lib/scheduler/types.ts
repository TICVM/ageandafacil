export interface PhotoLocation {
  id: string;
  name: string;
  description?: string;
  color?: string;
  isActive: boolean;
  /** Unidade da escola a que o local pertence (campo "unit" no Firestore). */
  unit?: string;
  /** Quando true, o agendamento exige a "Identificação do Local" (ex.: Sala 10). */
  requiresIdentifier?: boolean;
}

/** Horário configurável (coleção "available_time_slots") — espelha o schema
 *  usado pela página pública de reserva (/reserva), para que ambos os fluxos
 *  gravem e leiam exatamente os mesmos campos do banco. */
export interface AvailableTimeSlot {
  id: string;
  dayOfWeek: string; // 0=domingo ... 6=sábado (string, como no Firestore)
  startTime: string; // HH:mm
  durationMinutes: number;
  subject?: string | null;
  schoolSegmentId?: string | null;
  schoolClassId?: string | null;
  isActive: boolean;
}

export interface ScheduleBlock {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  reason?: string;
}

export interface AppSettings {
  minAdvanceBookingDays?: number;
  minAdvanceBookingHours?: number;
}

export interface SchoolSegment {
  id: string;
  name: string;
  unit?: string;
}

export interface SchoolClass {
  id: string;
  name: string;
  segmentId: string;
  order?: number;
}

export type AppointmentStatus =
  | "PENDING"
  | "EDITAR"
  | "APROVACAO"
  | "APROVADO"
  | "CONFIRMED"
  | "CANCELLED"
  | "RESCHEDULED"
  | "RE_SCHEDULE_REQUEST"
  | "COMPLETED"
  | "PUBLICADO"
  /** Reprogramado: usado quando a sessão é reagendada ou há pedido de reagendamento. */
  | "REPROGRAMADO";

export interface AppointmentHistoryEntry {
  timestamp: string;
  userId: string;
  userName: string;
  action: "CRIACAO" | "ALTERACAO_DE_STATUS" | "REAGENDAMENTO";
  details: string;
}

export interface Appointment {
  id: string;
  schoolClassId: string;
  className: string;
  teacherId: string;
  teacherName: string;
  photoLocationId: string;
  locationName: string;
  appointmentDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  /** Disciplina da sessão (campo "subject" no Firestore). */
  subject?: string | null;
  /** Identificação do local informada no agendamento (ex.: "Sala 10").
   *  Mesmo campo gravado pela página /reserva — evita divergências no banco. */
  locationIdentifier?: string | null;
  status: AppointmentStatus;
  observations?: string;
  history?: AppointmentHistoryEntry[];
}
