
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
  segmentId: string;
  teacherId: string;
}

export interface PhotoLocation {
  id: string;
  name: string;
  description: string;
  active: boolean;
}

export interface Booking {
  id: string;
  classId: string;
  teacherId: string;
  locationId: string;
  date: string; // ISO Date String YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  teacherNotes: string;
  aiBrief?: {
    detailedBrief: string;
    keyActivities: string[];
    preferredShots: string[];
    desiredMood: string;
  };
}

export interface TimeSlot {
  id: string;
  dayOfWeek: number; // 0-6
  startTime: string; // HH:mm
  durationMinutes: number;
  segmentId?: string; // Optional: restrict slot to specific segment
}
