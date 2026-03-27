
import { Booking, Class, PhotoLocation, Segment, TimeSlot, User } from './types';

export const segments: Segment[] = [
  { id: 'seg-1', name: 'Educação Infantil' },
  { id: 'seg-2', name: 'Ensino Fundamental I' },
  { id: 'seg-3', name: 'Ensino Fundamental II' },
];

export const users: User[] = [
  { id: 'admin-1', name: 'Admin User', email: 'admin@school.com', roleId: 'ADMIN' },
  { id: 'teacher-1', name: 'Prof. Helena', email: 'helena@school.com', roleId: 'TEACHER', segmentIds: ['seg-1'] },
  { id: 'teacher-2', name: 'Prof. Ricardo', email: 'ricardo@school.com', roleId: 'TEACHER', segmentIds: ['seg-2'] },
];

export const classes: Class[] = [
  { id: 'cls-1', name: 'Maternal', schoolSegmentId: 'seg-1' },
  { id: 'cls-2', name: 'Jardim I', schoolSegmentId: 'seg-1' },
  { id: 'cls-3', name: '1º Ano A', schoolSegmentId: 'seg-2' },
  { id: 'cls-4', name: '2º Ano B', schoolSegmentId: 'seg-2' },
];

export const locations: PhotoLocation[] = [
  { id: 'loc-1', name: 'Pátio Central', description: 'Área aberta com luz natural', isActive: true },
  { id: 'loc-2', name: 'Biblioteca', description: 'Ambiente tranquilo com livros', isActive: true },
  { id: 'loc-3', name: 'Jardim', description: 'Flores e gramado', isActive: true },
  { id: 'loc-4', name: 'Quadra Poliesportiva', description: 'Espaço amplo para fotos dinâmicas', isActive: true },
];

export let bookings: Booking[] = [
  {
    id: 'b-1',
    schoolClassId: 'cls-1',
    teacherId: 'teacher-1',
    teacherName: 'Prof. Helena',
    photoLocationId: 'loc-1',
    appointmentDate: '2025-04-10',
    startTime: '09:00',
    endTime: '10:00',
    status: 'CONFIRMED',
    observations: 'Fotos de interação com brinquedos.',
  }
];

export const slotTemplates: TimeSlot[] = [
  { id: 'slot-1', dayOfWeek: '1', startTime: '08:00', durationMinutes: 60, isActive: true },
  { id: 'slot-2', dayOfWeek: '1', startTime: '09:00', durationMinutes: 60, isActive: true },
  { id: 'slot-3', dayOfWeek: '1', startTime: '10:00', durationMinutes: 60, isActive: true },
  { id: 'slot-4', dayOfWeek: '2', startTime: '08:30', durationMinutes: 60, isActive: true },
  { id: 'slot-5', dayOfWeek: '2', startTime: '09:30', durationMinutes: 60, isActive: true },
];

export function getBookings() {
  return bookings;
}

export function addBooking(booking: Booking) {
  bookings.push(booking);
}

export function updateBooking(id: string, updates: Partial<Booking>) {
  bookings = bookings.map(b => b.id === id ? { ...b, ...updates } : b);
}

export function deleteBooking(id: string) {
  bookings = bookings.filter(b => b.id !== id);
}
