// Tipos para o Calendário de Publicações 2026

export type PublicationCategory = 
  | 'RT_PUBLICITY'
  | 'ATIVIDADES_VARIADAS'
  | 'PROGRAMA_BILINGUE'
  | 'EVENTOS_PEDAGOGICOS'
  | 'FERIADOS';

export type PublicationStatus =
  | 'PLANEJAMENTO'
  | 'BRIEFING_SOLICITADO'
  | 'BRIEFING_RECEBIDO'
  | 'EM_PRODUCAO'
  | 'EM_REVISAO'
  | 'AGUARDANDO_APROVACAO'
  | 'APROVADO'
  | 'AGENDADO'
  | 'PUBLICADO'
  | 'CANCELADO'
  | 'REPROGRAMADO';

export type Priority = 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE';

export type SchoolSeries =
  | 'Maternal'
  | 'Jardim'
  | 'Pré'
  | '1º Ano'
  | '2º Ano'
  | '3º Ano'
  | '4º Ano'
  | '5º Ano'
  | '6º Ano'
  | '7º Ano'
  | '8º Ano'
  | '9º Ano'
  | '1º Médio'
  | '2º Médio'
  | '3º Médio';

export type EventType = 'UNICO' | 'ANUAL' | 'MENSAL' | 'SEMANAL';

export interface Category {
  id: string;
  name: string;
  color: string;
  description?: string;
  isActive: boolean;
}

export interface Series {
  id: string;
  name: string;
  order: number;
  isActive?: boolean;
}

export interface ProductionDeadline {
  id: string;
  categoryId: string;
  seriesId: string;
  daysBefore: number;
  active: boolean;
}

export interface Holiday {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  type: string;
  recurring: boolean;
  description?: string;
  year?: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  roleId: string;
  isActive?: boolean;
}

export interface PublicationHistoryEntry {
  timestamp: string;
  userId: string;
  userName: string;
  action: 'CRIACAO' | 'ALTERACAO' | 'EXCLUSAO' | 'ALTERACAO_STATUS' | 'ALTERACAO_DATA';
  field?: string;
  oldValue?: any;
  newValue?: any;
  details: string;
}

export interface Publication {
  id: string;
  title: string;
  description?: string;
  categoryId: string;
  subcategoryId?: string;
  seriesId?: string;
  campaignId?: string;
  responsibleId?: string;
  responsibleName?: string;
  status: PublicationStatus;
  priority: Priority;
  
  // Datas
  publicationDate: string; // YYYY-MM-DD
  plannedDate?: string; // Data prevista para produção
  productionStartDate?: string;
  deliveryDate?: string;
  publishedAt?: string;
  
  // Configuração de prazo
  productionDays?: number;
  
  // Classificação
  segmentId?: string;
  unit?: string;
  contentType?: string;
  channel?: string;
  
  // Produção
  briefing?: string;
  creativeResponsible?: string;
  reviewResponsible?: string;
  agency?: string;
  briefingUrl?: string;
  materialUrl?: string;
  publicationUrl?: string;
  
  // Recorrência
  isRecurring?: boolean;
  recurrenceType?: EventType;
  recurrenceYear?: number;
  
  notes?: string;
  
  // Metadados
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  history?: PublicationHistoryEntry[];
  isDeleted?: boolean;
}

export interface CalendarSettings {
  id: string;
  currentYear: number;
  availableYears: number[];
  defaultProductionDays: number;
  considerWeekends: boolean;
  considerHolidays: boolean;
}

export interface ConflictAlert {
  type: 'MULTIPLAS_PUBLICACOES' | 'FERIADO' | 'FINAL_DE_SEMANA' | 'PRAZO_INSUFICIENTE' | 'DATA_PREVISTA_POSTERIOR';
  message: string;
  severity: 'WARNING' | 'ERROR' | 'INFO';
  publicationIds?: string[];
  date?: string;
}

export interface DashboardStats {
  totalPublications: number;
  publicationsThisMonth: number;
  plannedPublications: number;
  completedPublications: number;
  delayedPublications: number;
  nextWeekPublications: number;
  upcomingEvents: number;
  upcomingHolidays: number;
}
