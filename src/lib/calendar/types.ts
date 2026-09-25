export type PublicationCategoryType =
  | "RT_PUBLICITY"
  | "ATIVIDADES_VARIADAS"
  | "PROGRAMA_BILINGUE"
  | "EVENTOS_PEDAGOGICOS"
  | "FERIADOS";

export type PublicationStatus =
  | "PLANEJAMENTO"
  | "BRIEFING"
  | "PRODUCAO_CONTEUDO"
  | "DESIGN_ARTE"
  | "REVISAO_APROVACAO"
  | "AGENDADO"
  | "PUBLICADO"
  | "ATRASADO"
  | "CANCELADO"
  | "PAUSADO"
  | "REPROGRAMADO";

export type Priority = "BAIXA" | "MEDIA" | "ALTA" | "URGENTE";

export type SchoolSeriesType =
  | "MATERNAL"
  | "JARDIM"
  | "PRE"
  | "ANO_1"
  | "ANO_2"
  | "ANO_3"
  | "ANO_4"
  | "ANO_5"
  | "ANO_6"
  | "ANO_7"
  | "ANO_8"
  | "ANO_9"
  | "MEDIO_1"
  | "MEDIO_2"
  | "MEDIO_3";

export interface Category {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
}

export interface Series {
  id: string;
  name: string;
  order: number;
  isActive: boolean;
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
  year?: number;
  type: "NACIONAL" | "ESCOLAR" | "FACULTATIVO";
  recurring: boolean;
}

export interface PedagogicalEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  category: string;
  recurring: boolean;
}

export interface PublicationHistoryEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: "CRIACAO" | "ALTERACAO" | "EXCLUSAO" | "ALTERACAO_STATUS" | "ALTERACAO_DATA";
  details: string;
  previousValue?: string;
  newValue?: string;
}

export interface Publication {
  id: string;
  title: string;
  description?: string;
  categoryId: string;
  seriesId?: string;
  status: PublicationStatus;
  priority: Priority;
  publicationDate: string; // YYYY-MM-DD
  plannedDate?: string; // YYYY-MM-DD
  productionDays?: number;
  responsibleName?: string;
  responsibleEmail?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  history?: PublicationHistoryEntry[];
  isDeleted?: boolean;
}

export interface DashboardStats {
  total: number;
  thisMonth: number;
  planned: number;
  completed: number;
  delayed: number;
  next7Days: number;
}

export interface ConflictAlert {
  date: string;
  count: number;
  publications: Publication[];
}
