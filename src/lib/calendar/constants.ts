// Configurações padrão das categorias do Calendário de Publicações

import { Category, ProductionDeadline } from '@/lib/calendar/types';

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'RT_PUBLICITY',
    name: 'RT Publicity',
    color: '#FF6B6B',
    description: 'Publicações solicitadas pela agência RT Publicity',
    isActive: true
  },
  {
    id: 'ATIVIDADES_VARIADAS',
    name: 'Atividades Variadas',
    color: '#4ECDC4',
    description: 'Atividades diversas por série',
    isActive: true
  },
  {
    id: 'PROGRAMA_BILINGUE',
    name: 'Programa Bilíngue',
    color: '#9B59B6',
    description: 'Publicações do programa bilíngue',
    isActive: true
  },
  {
    id: 'EVENTOS_PEDAGOGICOS',
    name: 'Eventos Pedagógicos',
    color: '#F39C12',
    description: 'Eventos e datas comemorativas pedagógicas',
    isActive: true
  },
  {
    id: 'FERIADOS',
    name: 'Feriados',
    color: '#E74C3C',
    description: 'Feriados nacionais e municipais',
    isActive: true
  }
];

export const DEFAULT_SERIES = [
  { id: 'MATERNAL', name: 'Maternal', order: 1 },
  { id: 'JARDIM', name: 'Jardim', order: 2 },
  { id: 'PRE', name: 'Pré', order: 3 },
  { id: '1ANO', name: '1º Ano', order: 4 },
  { id: '2ANO', name: '2º Ano', order: 5 },
  { id: '3ANO', name: '3º Ano', order: 6 },
  { id: '4ANO', name: '4º Ano', order: 7 },
  { id: '5ANO', name: '5º Ano', order: 8 },
  { id: '6ANO', name: '6º Ano', order: 9 },
  { id: '7ANO', name: '7º Ano', order: 10 },
  { id: '8ANO', name: '8º Ano', order: 11 },
  { id: '9ANO', name: '9º Ano', order: 12 },
  { id: '1MEDIO', name: '1º Médio', order: 13 },
  { id: '2MEDIO', name: '2º Médio', order: 14 },
  { id: '3MEDIO', name: '3º Médio', order: 15 }
];

/**
 * Prazos de produção padrão conforme especificação
 * Valores em dias úteis antes da publicação
 */
export const DEFAULT_PRODUCTION_DEADLINES: ProductionDeadline[] = [
  // ATIVIDADES VARIADAS
  { id: 'AV_MATERNAL', categoryId: 'ATIVIDADES_VARIADAS', seriesId: 'MATERNAL', daysBefore: 5, active: true },
  { id: 'AV_JARDIM', categoryId: 'ATIVIDADES_VARIADAS', seriesId: 'JARDIM', daysBefore: 7, active: true },
  { id: 'AV_PRE', categoryId: 'ATIVIDADES_VARIADAS', seriesId: 'PRE', daysBefore: 8, active: true },
  { id: 'AV_1ANO', categoryId: 'ATIVIDADES_VARIADAS', seriesId: '1ANO', daysBefore: 20, active: true },
  { id: 'AV_2ANO', categoryId: 'ATIVIDADES_VARIADAS', seriesId: '2ANO', daysBefore: 7, active: true },
  { id: 'AV_3ANO', categoryId: 'ATIVIDADES_VARIADAS', seriesId: '3ANO', daysBefore: 8, active: true },
  { id: 'AV_4ANO', categoryId: 'ATIVIDADES_VARIADAS', seriesId: '4ANO', daysBefore: 8, active: true },
  { id: 'AV_5ANO', categoryId: 'ATIVIDADES_VARIADAS', seriesId: '5ANO', daysBefore: 30, active: true },
  { id: 'AV_6ANO', categoryId: 'ATIVIDADES_VARIADAS', seriesId: '6ANO', daysBefore: 9, active: true },
  { id: 'AV_7ANO', categoryId: 'ATIVIDADES_VARIADAS', seriesId: '7ANO', daysBefore: 9, active: true },
  { id: 'AV_8ANO', categoryId: 'ATIVIDADES_VARIADAS', seriesId: '8ANO', daysBefore: 7, active: true },
  { id: 'AV_9ANO', categoryId: 'ATIVIDADES_VARIADAS', seriesId: '9ANO', daysBefore: 8, active: true },
  { id: 'AV_1MEDIO', categoryId: 'ATIVIDADES_VARIADAS', seriesId: '1MEDIO', daysBefore: 10, active: true },
  { id: 'AV_2MEDIO', categoryId: 'ATIVIDADES_VARIADAS', seriesId: '2MEDIO', daysBefore: 8, active: true },
  { id: 'AV_3MEDIO', categoryId: 'ATIVIDADES_VARIADAS', seriesId: '3MEDIO', daysBefore: 8, active: true },
  
  // PROGRAMA BILÍNGUE
  { id: 'PB_MATERNAL', categoryId: 'PROGRAMA_BILINGUE', seriesId: 'MATERNAL', daysBefore: 19, active: true },
  { id: 'PB_JARDIM', categoryId: 'PROGRAMA_BILINGUE', seriesId: 'JARDIM', daysBefore: 10, active: true },
  { id: 'PB_PRE', categoryId: 'PROGRAMA_BILINGUE', seriesId: 'PRE', daysBefore: 44, active: true },
  { id: 'PB_1ANO', categoryId: 'PROGRAMA_BILINGUE', seriesId: '1ANO', daysBefore: 16, active: true },
  { id: 'PB_2ANO', categoryId: 'PROGRAMA_BILINGUE', seriesId: '2ANO', daysBefore: 17, active: true },
  { id: 'PB_3ANO', categoryId: 'PROGRAMA_BILINGUE', seriesId: '3ANO', daysBefore: 19, active: true },
  { id: 'PB_4ANO', categoryId: 'PROGRAMA_BILINGUE', seriesId: '4ANO', daysBefore: 19, active: true },
  { id: 'PB_5ANO', categoryId: 'PROGRAMA_BILINGUE', seriesId: '5ANO', daysBefore: 11, active: true },
  { id: 'PB_6ANO', categoryId: 'PROGRAMA_BILINGUE', seriesId: '6ANO', daysBefore: 16, active: true },
  { id: 'PB_7ANO', categoryId: 'PROGRAMA_BILINGUE', seriesId: '7ANO', daysBefore: 16, active: true },
  { id: 'PB_8ANO', categoryId: 'PROGRAMA_BILINGUE', seriesId: '8ANO', daysBefore: 14, active: true },
  { id: 'PB_9ANO', categoryId: 'PROGRAMA_BILINGUE', seriesId: '9ANO', daysBefore: 19, active: true }
];

export const DEFAULT_STATUSES = [
  { id: 'PLANEJAMENTO', name: 'Planejamento', color: '#95A5A6' },
  { id: 'BRIEFING_SOLICITADO', name: 'Briefing Solicitado', color: '#3498DB' },
  { id: 'BRIEFING_RECEBIDO', name: 'Briefing Recebido', color: '#2980B9' },
  { id: 'EM_PRODUCAO', name: 'Em Produção', color: '#F39C12' },
  { id: 'EM_REVISAO', name: 'Em Revisão', color: '#E67E22' },
  { id: 'AGUARDANDO_APROVACAO', name: 'Aguardando Aprovação', color: '#D35400' },
  { id: 'APROVADO', name: 'Aprovado', color: '#27AE60' },
  { id: 'AGENDADO', name: 'Agendado', color: '#1ABC9C' },
  { id: 'PUBLICADO', name: 'Publicado', color: '#229954' },
  { id: 'CANCELADO', name: 'Cancelado', color: '#C0392B' },
  { id: 'REPROGRAMADO', name: 'Reprogramado', color: '#8E44AD' }
];

export const DEFAULT_PRIORITIES = [
  { id: 'BAIXA', name: 'Baixa', color: '#95A5A6' },
  { id: 'MEDIA', name: 'Média', color: '#3498DB' },
  { id: 'ALTA', name: 'Alta', color: '#E67E22' },
  { id: 'URGENTE', name: 'Urgente', color: '#E74C3C' }
];

export const DEFAULT_HOLIDAYS_2026 = [
  { id: 'ANO_NOVO', name: 'Ano Novo', date: '2026-01-01', type: 'NACIONAL', recurring: true },
  { id: 'ANIV_SP', name: 'Aniversário de São Paulo', date: '2026-01-25', type: 'MUNICIPAL', recurring: true },
  { id: 'CARNAVAL', name: 'Carnaval', date: '2026-02-17', type: 'NACIONAL', recurring: true },
  { id: 'PAIXAO_CRISTO', name: 'Paixão de Cristo', date: '2026-04-03', type: 'NACIONAL', recurring: true },
  { id: 'PASCOA', name: 'Domingo de Páscoa', date: '2026-04-05', type: 'NACIONAL', recurring: true },
  { id: 'TIRADENTES', name: 'Tiradentes', date: '2026-04-21', type: 'NACIONAL', recurring: true },
  { id: 'DIA_TRABALHO', name: 'Dia do Trabalho', date: '2026-05-01', type: 'NACIONAL', recurring: true },
  { id: 'CORPUS_CHRISTI', name: 'Corpus Christi', date: '2026-06-04', type: 'NACIONAL', recurring: true },
  { id: 'REVOLUCAO_CONST', name: 'Revolução Constitucionalista de 1932', date: '2026-07-09', type: 'ESTADUAL', recurring: true },
  { id: 'INDEPENDENCIA', name: 'Independência do Brasil', date: '2026-09-07', type: 'NACIONAL', recurring: true },
  { id: 'NOSSA_SENHORA', name: 'Nossa Senhora Aparecida', date: '2026-10-12', type: 'NACIONAL', recurring: true },
  { id: 'FINADOS', name: 'Finados', date: '2026-11-02', type: 'NACIONAL', recurring: true },
  { id: 'PROCLAMACAO_REPUBLICA', name: 'Proclamação da República', date: '2026-11-15', type: 'NACIONAL', recurring: true },
  { id: 'CONSCIENCIA_NEGRA', name: 'Dia da Consciência Negra', date: '2026-11-20', type: 'NACIONAL', recurring: true },
  { id: 'NATAL', name: 'Natal', date: '2026-12-25', type: 'NACIONAL', recurring: true }
];

/**
 * Eventos Pedagógicos Padrão para 2026
 */
export const DEFAULT_PEDAGOGICAL_EVENTS_2026 = [
  { title: 'Aniversário de São Paulo', date: '2026-01-25', category: 'EVENTOS_PEDAGOGICOS' },
  { title: 'Volta às aulas - Fundamental I ao Médio', date: '2026-02-02', category: 'EVENTOS_PEDAGOGICOS' },
  { title: 'Volta às aulas - Educação Infantil e 1º ano', date: '2026-02-09', category: 'EVENTOS_PEDAGOGICOS' },
  { title: 'Dia do Livro Didático', date: '2026-02-27', category: 'EVENTOS_PEDAGOGICOS' },
  { title: 'Baile de Carnaval', date: '2026-02-13', category: 'EVENTOS_PEDAGOGICOS' },
  { title: 'Dia Internacional da Mulher', date: '2026-03-08', category: 'EVENTOS_PEDAGOGICOS' },
  { title: 'Dia da Escola', date: '2026-03-15', category: 'EVENTOS_PEDAGOGICOS' },
  { title: 'Início do Outono', date: '2026-03-20', category: 'EVENTOS_PEDAGOGICOS' },
  { title: 'Dia Nacional de Combate ao Bullying', date: '2026-04-07', category: 'EVENTOS_PEDAGOGICOS' },
  { title: 'Dia dos Povos Indígenas', date: '2026-04-19', category: 'EVENTOS_PEDAGOGICOS' },
  { title: 'Páscoa', date: '2026-04-05', category: 'EVENTOS_PEDAGOGICOS' },
  { title: 'Dia Nacional da Família na Escola', date: '2026-04-24', category: 'EVENTOS_PEDAGOGICOS' },
  { title: 'Dia da Educação', date: '2026-04-28', category: 'EVENTOS_PEDAGOGICOS' },
  { title: 'Dia do Trabalho', date: '2026-05-01', category: 'EVENTOS_PEDAGOGICOS' },
  { title: 'Dia das Mães', date: '2026-05-10', category: 'EVENTOS_PEDAGOGICOS' },
  { title: 'Festa Junina', date: '2026-06-24', category: 'EVENTOS_PEDAGOGICOS' },
  { title: 'Início do Inverno', date: '2026-06-20', category: 'EVENTOS_PEDAGOGICOS' },
  { title: 'Dia dos Pais', date: '2026-08-09', category: 'EVENTOS_PEDAGOGICOS' },
  { title: 'Dia do Estudante', date: '2026-08-11', category: 'EVENTOS_PEDAGOGICOS' },
  { title: 'Dia do Folclore', date: '2026-08-22', category: 'EVENTOS_PEDAGOGICOS' },
  { title: 'Dia da Independência do Brasil', date: '2026-09-07', category: 'EVENTOS_PEDAGOGICOS' },
  { title: 'Início da Primavera', date: '2026-09-22', category: 'EVENTOS_PEDAGOGICOS' },
  { title: 'Dia das Crianças', date: '2026-10-12', category: 'EVENTOS_PEDAGOGICOS' },
  { title: 'Dia do Professor', date: '2026-10-15', category: 'EVENTOS_PEDAGOGICOS' },
  { title: 'Dia da Consciência Negra', date: '2026-11-20', category: 'EVENTOS_PEDAGOGICOS' },
  { title: 'Natal', date: '2026-12-25', category: 'EVENTOS_PEDAGOGICOS' }
];
