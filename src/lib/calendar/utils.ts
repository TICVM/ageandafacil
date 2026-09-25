import { Holiday, Publication, ConflictAlert } from "./types";

export function parseDateString(dateStr: string): Date {
  const parts = dateStr.split("-");
  return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
}

export function formatDateToISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isHoliday(dateStr: string, holidays: Holiday[]): Holiday | undefined {
  return holidays.find((h) => {
    if (h.date === dateStr) return true;
    if (h.recurring) {
      // compare MM-DD
      const datePart = dateStr.substring(5);
      const holidayPart = h.date.substring(5);
      return datePart === holidayPart;
    }
    return false;
  });
}

export function isBusinessDay(dateInput: Date | string, holidays: Holiday[]): boolean {
  const date = typeof dateInput === "string" ? parseDateString(dateInput) : dateInput;
  const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }
  const dateStr = formatDateToISO(date);
  return !isHoliday(dateStr, holidays);
}

export function addBusinessDays(
  startDateStr: string,
  days: number,
  holidays: Holiday[],
  subtract = false
): string {
  if (!startDateStr || days <= 0) return startDateStr;
  const current = parseDateString(startDateStr);
  let counted = 0;
  const step = subtract ? -1 : 1;

  while (counted < days) {
    current.setDate(current.getDate() + step);
    if (isBusinessDay(current, holidays)) {
      counted++;
    }
  }

  return formatDateToISO(current);
}

/**
 * Calculates planned date by subtracting production business days before the publication date
 */
export function calculatePlannedDate(
  publicationDateStr: string,
  productionDays: number,
  holidays: Holiday[]
): string {
  if (!publicationDateStr) return "";
  if (!productionDays || productionDays <= 0) return publicationDateStr;
  return addBusinessDays(publicationDateStr, productionDays, holidays, true);
}

export function checkDateConflict(
  publications: Publication[],
  pub: { id?: string; publicationDate?: string }
): ConflictAlert | null {
  if (!pub.publicationDate) return null;
  const matches = publications.filter(
    (p) => !p.isDeleted && p.publicationDate === pub.publicationDate && p.id !== pub.id
  );
  if (matches.length > 0) {
    return {
      date: pub.publicationDate,
      count: matches.length,
      publications: matches,
    };
  }
  return null;
}

export function formatDateForDisplay(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  return parts[2] ? String(parseInt(parts[2], 10)) : dateStr;
}

export const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function getMonthName(monthIndex: number): string {
  return MONTH_NAMES[monthIndex] || "";
}

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  holiday?: Holiday;
}

export function getDaysInMonthGrid(year: number, monthIndex: number, holidays: Holiday[]): CalendarDay[] {
  const firstDayOfMonth = new Date(year, monthIndex, 1);
  const lastDayOfMonth = new Date(year, monthIndex + 1, 0);

  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun
  const totalDays = lastDayOfMonth.getDate();

  const days: CalendarDay[] = [];
  const todayStr = formatDateToISO(new Date());

  // Previous month padding
  const prevMonthLastDay = new Date(year, monthIndex, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const dayNum = prevMonthLastDay - i;
    const dateObj = new Date(year, monthIndex - 1, dayNum);
    const dateStr = formatDateToISO(dateObj);
    days.push({
      date: dateStr,
      dayNumber: dayNum,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      isWeekend: dateObj.getDay() === 0 || dateObj.getDay() === 6,
      holiday: isHoliday(dateStr, holidays),
    });
  }

  // Current month days
  for (let i = 1; i <= totalDays; i++) {
    const dateObj = new Date(year, monthIndex, i);
    const dateStr = formatDateToISO(dateObj);
    days.push({
      date: dateStr,
      dayNumber: i,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      isWeekend: dateObj.getDay() === 0 || dateObj.getDay() === 6,
      holiday: isHoliday(dateStr, holidays),
    });
  }

  // Next month padding to fill complete weeks (multiple of 7)
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      const dateObj = new Date(year, monthIndex + 1, i);
      const dateStr = formatDateToISO(dateObj);
      days.push({
        date: dateStr,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isWeekend: dateObj.getDay() === 0 || dateObj.getDay() === 6,
        holiday: isHoliday(dateStr, holidays),
      });
    }
  }

  return days;
}
