
import { Booking, Class, PhotoLocation, Segment, TimeSlot, User } from './types';

export const segments: Segment[] = [
  { id: 'seg-1', name: 'Educação Infantil' },
  { id: 'seg-2', name: 'Ensino Fundamental I' },
  { id: 'seg-3', name: 'Ensino Fundamental II' },
];

export const users: User[] = [
  { id: 'admin-1', name: 'Admin User', email: 'admin@school.com', role: 'ADMIN' },
  { id: 'teacher-1', name: 'Prof. Helena', email: 'helena@school.com', role: 'TEACHER', segmentId: 'seg-1' },
  { id: 'teacher-2', name: 'Prof. Ricardo', email: 'ricardo@school.com', role: 'TEACHER', segmentId: 'seg-2' },
];

export const classes: Class[] = [
  { id: 'cls-1', name: 'Maternal', segmentId: 'seg-1', teacherId: 'teacher-1' },
  { id: 'cls-2', name: 'Jardim I', segmentId: 'seg-1', teacherId: 'teacher-1' },
  { id: 'cls-3', name: '1º Ano A', segmentId: 'seg-2', teacherId: 'teacher-2' },
  { id: 'cls-4', name: '2º Ano B', segmentId: 'seg-2', teacherId: 'teacher-2' },
];

export const locations: PhotoLocation[] = [
  { id: 'loc-1', name: 'Pátio Central', description: 'Área aberta com luz natural', active: true },
  { id: 'loc-2', name: 'Biblioteca', description: 'Ambiente tranquilo com livros', active: true },
  { id: 'loc-3', name: 'Jardim', description: 'Flores e gramado', active: true },
  { id: 'loc-4', name: 'Quadra Poliesportiva', description: 'Espaço amplo para fotos dinâmicas', active: true },
];

export let bookings: Booking[] = [
  {
    id: 'b-1',
    classId: 'cls-1',
    teacherId: 'teacher-1',
    locationId: 'loc-1',
    date: '2025-04-10',
    startTime: '09:00',
    endTime: '10:00',
    status: 'CONFIRMED',
    teacherNotes: 'Fotos de interação com brinquedos.',
  }
];

export const slotTemplates: TimeSlot[] = [
  { id: 'slot-1', dayOfWeek: 1, startTime: '08:00', durationMinutes: 60 },
  { id: 'slot-2', dayOfWeek: 1, startTime: '09:00', durationMinutes: 60 },
  { id: 'slot-3', dayOfWeek: 1, startTime: '10:00', durationMinutes: 60 },
  { id: 'slot-4', dayOfWeek: 2, startTime: '08:30', durationMinutes: 60 },
  { id: 'slot-5', dayOfWeek: 2, startTime: '09:30', durationMinutes: 60 },
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
