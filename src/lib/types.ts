
export type UserRole = 'ADMIN' | 'COORDINATOR' | 'TEACHER';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  segmentIds?: string[]; // Para Coordenadores (múltiplos agora)
  classIds?: string[]; // Para Professores
  isActive?: boolean;
  createdAt?: string;
}

export interface Segment {
  id: string;
  name: string;
  unit?: string;
  order?: number;
  isActive?: boolean;
}

export interface Class {
  id: string;
  name: string;
  schoolSegmentId: string;
  order?: number;
  isActive?: boolean;
}

export interface PhotoLocation {
  id: string;
  name: string;
  unit?: string;
  description: string;
  isActive: boolean;
  requiresIdentifier?: boolean;
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
  locationIdentifier?: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  observations: string;
  sessionDurationMinutes: number;
  aiBrief?: AISessionBriefAssistantOutput | null;
  createdAt?: any;
}

export interface TimeSlot {
  id: string;
  dayOfWeek: string;
  startTime: string;
  durationMinutes: number;
  schoolSegmentId?: string | null;
  schoolClassId?: string | null;
  isActive: boolean;
}

export interface ScheduleBlock {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  reason: string;
  createdAt: any;
}
