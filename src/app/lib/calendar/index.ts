// Hook principal que exporta todos os hooks do calendário
// Importe deste arquivo para usar em seus componentes

export {
  usePublications,
  useHolidays,
  useCategories,
  useProductionDeadlines,
  useSeries,
  usePedagogicalEvents,
  useCalendarSettings
} from './hooks';

// Exportar tipos
export type {
  Publication,
  Holiday,
  Category,
  Series,
  ProductionDeadline,
  PublicationHistoryEntry,
  CalendarSettings,
  ConflictAlert,
  DashboardStats
} from './types';

// Exportar constantes
export {
  DEFAULT_CATEGORIES,
  DEFAULT_SERIES,
  DEFAULT_PRODUCTION_DEADLINES,
  DEFAULT_STATUSES,
  DEFAULT_PRIORITIES,
  DEFAULT_HOLIDAYS_2026,
  DEFAULT_PEDAGOGICAL_EVENTS_2026
} from './constants';

// Exportar utilitários
export {
  isBusinessDay,
  addBusinessDays,
  calculatePlannedDate,
  checkDateConflict,
  isHoliday,
  formatDateForDisplay,
  formatDateShort,
  getMonthName,
  getDaysInMonth,
  isValidDate,
  areDatesEqual,
  isPast,
  isFuture,
  getBusinessDaysBetween
} from './utils';

// Exportar configurações do banco
export {
  COLLECTIONS,
  DEFAULT_YEAR,
  HOLIDAY_TYPES,
  RECURRENCE_TYPES,
  SCHOOL_SEGMENTS,
  SERIES_TO_SEGMENT,
  USER_ROLES,
  ROLE_PERMISSIONS
} from './db-config';
