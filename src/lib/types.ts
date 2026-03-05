
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
}

export interface Class {
  id: string;
  name: string;
  schoolSegmentId: string;
  responsibleTeacherId: string;
}

export interface PhotoLocation {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
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
  teacherId: string;
  photoLocationId: string;
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
