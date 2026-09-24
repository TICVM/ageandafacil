// Configuração das coleções do Firestore para o Calendário de Publicações

export const COLLECTIONS = {
  PUBLICATIONS: 'publications',
  CATEGORIES: 'publication_categories',
  SERIES: 'publication_series',
  HOLIDAYS: 'holidays',
  PRODUCTION_DEADLINES: 'production_deadlines',
  PEDAGOGICAL_EVENTS: 'pedagogical_events',
  USERS: 'users',
  AUDIT_LOGS: 'audit_logs',
  CAMPAIGNS: 'campaigns',
  SETTINGS: 'calendar_settings'
} as const;

export type CollectionName = typeof COLLECTIONS[keyof typeof COLLECTIONS];

/**
 * Configuração inicial do ano padrão
 */
export const DEFAULT_YEAR = 2026;

/**
 * Tipos de feriado
 */
export const HOLIDAY_TYPES = {
  NACIONAL: 'NACIONAL',
  ESTADUAL: 'ESTADUAL',
  MUNICIPAL: 'MUNICIPAL',
  ESCOLAR: 'ESCOLAR',
  RECESSO: 'RECESSO',
  OUTRO: 'OUTRO'
} as const;

/**
 * Tipos de recorrência de eventos
 */
export const RECURRENCE_TYPES = {
  UNICO: 'UNICO',
  ANUAL: 'ANUAL',
  MENSAL: 'MENSAL',
  SEMANAL: 'SEMANAL'
} as const;

/**
 * Segmentos escolares
 */
export const SCHOOL_SEGMENTS = [
  { id: 'EDUCACAO_INFANTIL', name: 'Educação Infantil' },
  { id: 'FUNDAMENTAL_I', name: 'Ensino Fundamental I' },
  { id: 'FUNDAMENTAL_II', name: 'Ensino Fundamental II' },
  { id: 'ENSINO_MEDIO', name: 'Ensino Médio' }
] as const;

/**
 * Mapeamento de séries para segmentos
 */
export const SERIES_TO_SEGMENT: Record<string, string> = {
  MATERNAL: 'EDUCACAO_INFANTIL',
  JARDIM: 'EDUCACAO_INFANTIL',
  PRE: 'EDUCACAO_INFANTIL',
  '1ANO': 'FUNDAMENTAL_I',
  '2ANO': 'FUNDAMENTAL_I',
  '3ANO': 'FUNDAMENTAL_I',
  '4ANO': 'FUNDAMENTAL_I',
  '5ANO': 'FUNDAMENTAL_I',
  '6ANO': 'FUNDAMENTAL_II',
  '7ANO': 'FUNDAMENTAL_II',
  '8ANO': 'FUNDAMENTAL_II',
  '9ANO': 'FUNDAMENTAL_II',
  '1MEDIO': 'ENSINO_MEDIO',
  '2MEDIO': 'ENSINO_MEDIO',
  '3MEDIO': 'ENSINO_MEDIO'
};

/**
 * Roles/Permissões de usuário
 */
export const USER_ROLES = {
  ADMIN: 'ADMIN',
  GESTOR: 'GESTOR',
  EDITOR: 'EDITOR',
  VISUALIZADOR: 'VISUALIZADOR'
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

/**
 * Permissões por role
 */
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  ADMIN: ['*'], // Todas as permissões
  GESTOR: ['create', 'read', 'update', 'delete', 'reports'],
  EDITOR: ['create', 'read', 'update'],
  VISUALIZADOR: ['read']
};
