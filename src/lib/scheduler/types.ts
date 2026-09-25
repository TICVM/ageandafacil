export interface PhotoLocation {
  id: string;
  name: string;
  description?: string;
  color?: string;
  isActive: boolean;
}

export interface SchoolSegment {
  id: string;
  name: string;
}

export interface SchoolClass {
  id: string;
  name: string;
  segmentId: string;
}

export type AppointmentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "RESCHEDULED";

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
  status: AppointmentStatus;
  observations?: string;
  history?: AppointmentHistoryEntry[];
}
