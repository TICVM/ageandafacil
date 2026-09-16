import { addDays, isWeekend, parseISO, format, startOfWeek, endOfWeek, eachDayOfInterval, getDate, getMonth, getYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Holiday } from './types';

/**
 * Calcula a data da Páscoa para um determinado ano (algoritmo de Gauss)
 * @param year - Ano
 * @returns Data da Páscoa (Domingo de Páscoa)
 */
function calculateEasterDate(year: number): Date {
  const f = Math.floor,
    G = year % 19,
    C = f(year / 100),
    H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30,
    I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11)),
    J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7,
    L = I - J,
    month = 3 + f((L + 40) / 44),
    day = L + 28 - 31 * f(month / 4);
  
  return new Date(year, month - 1, day);
}

/**
 * Gera automaticamente os feriados nacionais, estaduais (SP) e municipais (São Paulo) para um ano
 * @param year - Ano para gerar os feriados
 * @returns Array de feriados automáticos de São Paulo
 */
export function generateSaoPauloHolidays(year: number): Omit<Holiday, 'id'>[] {
  const easterDate = calculateEasterDate(year);
  
  // Calcula datas móveis baseadas na Páscoa
  const carnavalDate = addDays(easterDate, -47); // Terça-feira de Carnaval
  const paixaoCristoDate = addDays(easterDate, -2); // Sexta-feira Santa
  const corpusChristiDate = addDays(easterDate, 60); // Corpus Christi (60 dias após Páscoa)
  
  const holidays: Omit<Holiday, 'id'>[] = [
    // Feriado Nacional - Ano Novo
    {
      name: 'Ano Novo',
      date: `${year}-01-01`,
      type: 'NACIONAL',
      recurring: true,
      year,
      description: 'Celebração do início do novo ano'
    },
    // Feriado Municipal - Aniversário de São Paulo
    {
      name: 'Aniversário de São Paulo',
      date: `${year}-01-25`,
      type: 'MUNICIPAL',
      recurring: true,
      year,
      description: 'Fundação da cidade de São Paulo'
    },
    // Feriado Nacional - Carnaval (ponto facultativo, mas amplamente observado)
    {
      name: 'Carnaval',
      date: format(carnavalDate, 'yyyy-MM-dd'),
      type: 'NACIONAL',
      recurring: true,
      year,
      description: 'Terça-feira de Carnaval'
    },
    // Feriado Nacional - Paixão de Cristo
    {
      name: 'Paixão de Cristo',
      date: format(paixaoCristoDate, 'yyyy-MM-dd'),
      type: 'NACIONAL',
      recurring: true,
      year,
      description: 'Sexta-feira Santa'
    },
    // Feriado Nacional - Tiradentes
    {
      name: 'Tiradentes',
      date: `${year}-04-21`,
      type: 'NACIONAL',
      recurring: true,
      year,
      description: 'Homenagem a Joaquim José da Silva Xavier'
    },
    // Feriado Nacional - Dia do Trabalho
    {
      name: 'Dia do Trabalho',
      date: `${year}-05-01`,
      type: 'NACIONAL',
      recurring: true,
      year,
      description: 'Dia Internacional do Trabalhador'
    },
    // Feriado Nacional - Corpus Christi
    {
      name: 'Corpus Christi',
      date: format(corpusChristiDate, 'yyyy-MM-dd'),
      type: 'NACIONAL',
      recurring: true,
      year,
      description: 'Festa litúrgica católica'
    },
    // Feriado Estadual (SP) - Revolução Constitucionalista
    {
      name: 'Revolução Constitucionalista de 1932',
      date: `${year}-07-09`,
      type: 'ESTADUAL',
      recurring: true,
      year,
      description: 'Revolução Constitucionalista de São Paulo'
    },
    // Feriado Nacional - Independência do Brasil
    {
      name: 'Independência do Brasil',
      date: `${year}-09-07`,
      type: 'NACIONAL',
      recurring: true,
      year,
      description: 'Proclamação da Independência do Brasil'
    },
    // Feriado Nacional - Nossa Senhora Aparecida
    {
      name: 'Nossa Senhora Aparecida',
      date: `${year}-10-12`,
      type: 'NACIONAL',
      recurring: true,
      year,
      description: 'Dia de Nossa Senhora Aparecida, padroeira do Brasil'
    },
    // Feriado Nacional - Finados
    {
      name: 'Finados',
      date: `${year}-11-02`,
      type: 'NACIONAL',
      recurring: true,
      year,
      description: 'Dia de Finados'
    },
    // Feriado Nacional - Proclamação da República
    {
      name: 'Proclamação da República',
      date: `${year}-11-15`,
      type: 'NACIONAL',
      recurring: true,
      year,
      description: 'Proclamação da República Federativa do Brasil'
    },
    // Feriado Nacional - Dia da Consciência Negra
    {
      name: 'Dia da Consciência Negra',
      date: `${year}-11-20`,
      type: 'NACIONAL',
      recurring: true,
      year,
      description: 'Dia Nacional de Zumbi e da Consciência Negra'
    },
    // Feriado Nacional - Natal
    {
      name: 'Natal',
      date: `${year}-12-25`,
      type: 'NACIONAL',
      recurring: true,
      year,
      description: 'Celebração do nascimento de Jesus Cristo'
    }
  ];
  
  return holidays;
}

/**
 * Mescla feriados automáticos com feriados manuais, evitando duplicatas
 * @param autoHolidays - Feriados automáticos gerados
 * @param manualHolidays - Feriados manuais adicionados pelo usuário
 * @returns Array completo de feriados sem duplicatas
 */
export function mergeHolidays(autoHolidays: Holiday[], manualHolidays: Holiday[]): Holiday[] {
  // Cria um mapa de feriados automáticos por data para evitar duplicatas
  const autoDatesMap = new Map<string, Holiday>();
  autoHolidays.forEach(h => {
    const key = h.recurring ? format(parseISO(h.date), 'MM-dd') : h.date;
    autoDatesMap.set(key, h);
  });
  
  // Filtra feriados manuais que não conflitam com automáticos
  const uniqueManualHolidays = manualHolidays.filter(manualHoliday => {
    const key = manualHoliday.recurring ? format(parseISO(manualHoliday.date), 'MM-dd') : manualHoliday.date;
    
    // Verifica se já existe um feriado automático com a mesma data
    if (autoDatesMap.has(key)) {
      return false; // Ignora feriado manual duplicado
    }
    
    return true;
  });
  
  // Combina feriados automáticos e manuais únicos
  return [...autoHolidays, ...uniqueManualHolidays];
}

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
 * Calcula dias úteis antes de uma data (versão simplificada com array de strings)
 * @param publicationDate - Data da publicação
 * @param businessDays - Dias úteis para subtrair
 * @param holidayDates - Array de datas de feriados (YYYY-MM-DD)
 */
export function calculateBusinessDaysBefore(
  publicationDate: Date,
  businessDays: number,
  holidayDates: string[] = []
): Date {
  let result = new Date(publicationDate);
  let daysCounted = 0;
  
  while (daysCounted < businessDays) {
    result = addDays(result, -1);
    
    const isWeekendDay = isWeekend(result);
    const dateStr = format(result, 'yyyy-MM-dd');
    const isHoliday = holidayDates.includes(dateStr);
    
    // Check recurring holidays (MM-DD)
    const isRecurringHoliday = holidayDates.some(h => {
      if (h.length === 5) { // MM-DD format
        return format(result, 'MM-dd') === h;
      }
      return false;
    });
    
    if (!isWeekendDay && !isHoliday && !isRecurringHoliday) {
      daysCounted++;
    }
  }
  
  return result;
}

/**
 * Formata data para input date (YYYY-MM-DD)
 */
export function formatDateForInput(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Obtém os dias da semana para visão semanal
 * @param currentDate - Data atual
 * @returns Array de 7 datas representando a semana
 */
export function getWeekDays(currentDate: Date): (Date | null)[] {
  const start = startOfWeek(currentDate, { weekStartsOn: 0 }); // Domingo como primeiro dia
  const end = endOfWeek(currentDate, { weekStartsOn: 0 });
  
  const days = eachDayOfInterval({ start, end });
  return days;
}

/**
 * Obtém todos os meses do ano para visão anual
 * @param year - Ano
 * @returns Array de arrays representando os dias de cada mês
 */
export function getMonthsInYear(year: number): (number | null)[][] {
  const months: (number | null)[][] = [];
  
  for (let month = 0; month < 12; month++) {
    months.push(getDaysInMonth(year, month));
  }
  
  return months;
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
