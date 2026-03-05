
export type UserRole = 'ADMIN' | 'TEACHER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  segmentId?: string;
}

export interface Segment {
  id: string;
  name: string;
  order?: number;
}

export interface Class {
  id: string;
  name: string;
  schoolSegmentId: string;
  order?: number;
}

export interface PhotoLocation {
  id: string;
  name: string;
  unit?: string;
  description: string;
  isActive: boolean;
  requiresIdentifier?: boolean; // Se true, abre campo para nº da sala
}

export interface AISessionBriefAssistantOutput {
  detailedBrief: string;
  keyActivities: string[];
  preferredShots: string[];
  desiredMood: string;
}

export interface Booking {
  id: string;
  schoolClassId: string;
  teacherId?: string;
  teacherName: string;
  photoLocationId: string;
  locationIdentifier?: string; // Ex: "Sala 12", "Laboratório 2"
  appointmentDate: string; // ISO Date String YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  observations: string;
  sessionDurationMinutes: number;
  aiBrief?: AISessionBriefAssistantOutput | null;
}

export interface TimeSlot {
  id: string;
  dayOfWeek: string; // 0-6
  startTime: string; // HH:mm
  durationMinutes: number;
  schoolSegmentId?: string | null;
  schoolClassId?: string | null;
  isActive: boolean;
}
