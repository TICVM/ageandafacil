import { PhotoLocation, SchoolSegment, SchoolClass, Appointment } from "./types";

export const DEFAULT_LOCATIONS: PhotoLocation[] = [
  { id: "loc-1", name: "Estúdio Principal (Sala Maker)", description: "Iluminação profissional e fundo infinito.", color: "#2563EB", isActive: true },
  { id: "loc-2", name: "Pátio Central & Jardim", description: "Luz natural e área verde arborizada.", color: "#059669", isActive: true },
  { id: "loc-3", name: "Biblioteca & Espaço Leitura", description: "Ambiente acolhedor e pedagógico.", color: "#D97706", isActive: true },
  { id: "loc-4", name: "Ginásio Poliesportivo", description: "Espaço amplo para fotos de turmas e esportes.", color: "#7C3AED", isActive: true },
  { id: "loc-5", name: "Fachada Principal da Escola", description: "Fotos institucionais e formandos.", color: "#DC2626", isActive: true },
];

export const DEFAULT_SEGMENTS: SchoolSegment[] = [
  { id: "seg-infantil", name: "Educação Infantil" },
  { id: "seg-fund1", name: "Ensino Fundamental I" },
  { id: "seg-fund2", name: "Ensino Fundamental II" },
  { id: "seg-medio", name: "Ensino Médio" },
];

export const DEFAULT_CLASSES: SchoolClass[] = [
  { id: "cls-mat-a", name: "Maternal A", segmentId: "seg-infantil" },
  { id: "cls-mat-b", name: "Maternal B", segmentId: "seg-infantil" },
  { id: "cls-jar-a", name: "Jardim A", segmentId: "seg-infantil" },
  { id: "cls-pre-a", name: "Pré A", segmentId: "seg-infantil" },
  { id: "cls-1ano", name: "1º Ano A", segmentId: "seg-fund1" },
  { id: "cls-2ano", name: "2º Ano A", segmentId: "seg-fund1" },
  { id: "cls-3ano", name: "3º Ano A", segmentId: "seg-fund1" },
  { id: "cls-4ano", name: "4º Ano A", segmentId: "seg-fund1" },
  { id: "cls-5ano", name: "5º Ano A", segmentId: "seg-fund1" },
  { id: "cls-6ano", name: "6º Ano A", segmentId: "seg-fund2" },
  { id: "cls-7ano", name: "7º Ano A", segmentId: "seg-fund2" },
  { id: "cls-8ano", name: "8º Ano A", segmentId: "seg-fund2" },
  { id: "cls-9ano", name: "9º Ano A", segmentId: "seg-fund2" },
  { id: "cls-med1", name: "1º Médio A", segmentId: "seg-medio" },
  { id: "cls-med2", name: "2º Médio A", segmentId: "seg-medio" },
  { id: "cls-med3", name: "3º Terceirão (Formandos)", segmentId: "seg-medio" },
];

export const DEFAULT_TIME_SLOTS = [
  { startTime: "08:00", endTime: "08:50" },
  { startTime: "09:00", endTime: "09:50" },
  { startTime: "10:10", endTime: "11:00" },
  { startTime: "11:10", endTime: "12:00" },
  { startTime: "13:30", endTime: "14:20" },
  { startTime: "14:30", endTime: "15:20" },
  { startTime: "15:40", endTime: "16:30" },
];

export const SAMPLE_APPOINTMENTS: Appointment[] = [
  },
];  
  
