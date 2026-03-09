
export type UserRole = string;

export interface AppPermissions {
  canManageUsers: boolean;
  canConfigureSlots: boolean;
  canManageLocations: boolean;
  canManageClasses: boolean;
  canViewReports: boolean;
  canViewAllAppointments: boolean;
  canViewSegmentAppointments: boolean;
  canViewClassAppointments: boolean;
  canEditAppointments: boolean;
  canCancelAppointments: boolean;
  canDeleteAppointments: boolean;
  canCreateBookings: boolean;
  canChangeStatus: boolean;
}

export interface RoleConfig extends AppPermissions {
  id: string;
  name: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  roleId: string;
  segmentIds?: string[];
  classIds?: string[];
  isActive?: boolean;
  createdAt?: string;
  role?: string; 
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

export interface HistoryEntry {
  timestamp: string;
  userId: string;
  userName: string;
  action: 'CREATE' | 'STATUS_CHANGE' | 'RESCHEDULE';
  details: string;
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
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'RESCHEDULED' | 'RE_SCHEDULE_REQUEST';
  observations: string;
  sessionDurationMinutes: number;
  aiBrief?: AISessionBriefAssistantOutput | null;
  history?: HistoryEntry[];
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
