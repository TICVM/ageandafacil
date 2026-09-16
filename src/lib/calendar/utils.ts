import { addDays, isWeekend, parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Holiday } from './types';

/**
 * Verifica se uma data é um dia útil (não é fim de semana e não é feriado)
 */
export function isBusinessDay(date: Date, holidays: Holiday[]): boolean {
  if (isWeekend(date)) {
    return false;
  }
  
  const dateStr = format(date, 'yyyy-MM-dd');
  const isHoliday = holidays.some(h => {
    const holidayDate = h.date;
    // Verifica feriados do ano específico ou recorrentes
    if (h.recurring) {
      const holidayMonthDay = format(parseISO(holidayDate), 'MM-dd');
      const currentDateMonthDay = format(date, 'MM-dd');
      return holidayMonthDay === currentDateMonthDay;
    }
    return holidayDate === dateStr;
  });
  
  return !isHoliday;
}

/**
 * Adiciona dias úteis a uma data
 * @param startDate - Data inicial
 * @param businessDays - Quantidade de dias úteis para adicionar
 * @param holidays - Lista de feriados
 * @param subtract - Se true, subtrai os dias; se false, adiciona
 */
export function addBusinessDays(
  startDate: Date,
  businessDays: number,
  holidays: Holiday[],
  subtract: boolean = false
): Date {
  let result = new Date(startDate);
  let daysAdded = 0;
  const direction = subtract ? -1 : 1;
  
  while (daysAdded < Math.abs(businessDays)) {
    result = addDays(result, direction);
    
    if (isBusinessDay(result, holidays)) {
      daysAdded++;
    }
  }
  
  return result;
}

/**
 * Calcula a data prevista para produção baseada na data de publicação e prazo
 * @param publicationDate - Data da publicação
 * @param productionDays - Prazo em dias úteis antes da publicação
 * @param holidays - Lista de feriados
 */
export function calculatePlannedDate(
  publicationDate: string,
  productionDays: number,
  holidays: Holiday[]
): string {
  const pubDate = parseISO(publicationDate);
  const plannedDate = addBusinessDays(pubDate, productionDays, holidays, true);
  return format(plannedDate, 'yyyy-MM-dd');
}

/**
 * Verifica se há conflito de datas (publicações no mesmo dia)
 */
export function checkDateConflict<T extends { publicationDate: string; id?: string }>(
  publications: T[],
  newPublication: T
): number {
  return publications.filter(
    p => p.publicationDate === newPublication.publicationDate && p.id !== newPublication.id
  ).length;
}

/**
 * Verifica se uma data cai em feriado
 */
export function isHoliday(date: string, holidays: Holiday[]): boolean {
  const parsedDate = parseISO(date);
  return !isBusinessDay(parsedDate, holidays);
}

/**
 * Formata data para exibição no calendário
 */
export function formatDateForDisplay(date: string): string {
  try {
    return format(parseISO(date), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return date;
  }
}

/**
 * Formata data curta para calendário (apenas dia)
 */
export function formatDateShort(date: string): string {
  try {
    return format(parseISO(date), 'dd', { locale: ptBR });
  } catch {
    return date;
  }
}

/**
 * Obtém o nome do mês em português
 */
export function getMonthName(month: number, year: number): string {
  const date = new Date(year, month, 1);
  return format(date, 'MMMM', { locale: ptBR });
}

/**
 * Gera os dias do mês para exibição no calendário
 */
export function getDaysInMonth(year: number, month: number): (number | null)[] {
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  
  const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Domingo, 6 = Sábado
  const totalDays = lastDayOfMonth.getDate();
  
  const days: (number | null)[] = [];
  
  // Adiciona dias vazios antes do primeiro dia do mês
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null);
  }
  
  // Adiciona todos os dias do mês
  for (let day = 1; day <= totalDays; day++) {
    days.push(day);
  }
  
  return days;
}

/**
 * Valida se uma data é válida
 */
export function isValidDate(dateString: string): boolean {
  const date = parseISO(dateString);
  return !isNaN(date.getTime());
}

/**
 * Compara duas datas ignorando o horário
 */
export function areDatesEqual(date1: string, date2: string): boolean {
  return format(parseISO(date1), 'yyyy-MM-dd') === format(parseISO(date2), 'yyyy-MM-dd');
}

/**
 * Verifica se uma data está no passado
 */
export function isPast(dateString: string): boolean {
  const date = parseISO(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

/**
 * Verifica se uma data está no futuro
 */
export function isFuture(dateString: string): boolean {
  const date = parseISO(dateString);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return date > today;
}

/**
 * Obtém dias úteis entre duas datas
 */
export function getBusinessDaysBetween(startDate: string, endDate: string, holidays: Holiday[]): number {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  
  let count = 0;
  let current = new Date(start);
  
  const isEndDateGreater = end > start;
  
  while (isEndDateGreater ? current <= end : current >= end) {
    if (isBusinessDay(current, holidays)) {
      count++;
    }
    current = addDays(current, isEndDateGreater ? 1 : -1);
  }
  
  return count;
}
