/**
 * Feriados automáticos — Brasil (nacionais) e São Paulo Capital.
 *
 * Gera programaticamente, para qualquer ano, os feriados nacionais e os
 * feriados da cidade de São Paulo/estado de SP, incluindo as datas móveis
 * calculadas a partir da Páscoa (algoritmo de Butcher/Meeus).
 *
 * Esses feriados alimentam automaticamente:
 *   - a lista de feriados do calendário (useHolidays);
 *   - as publicações da categoria "Feriados" no Controle de Publicações
 *     (geradas sem necessidade de lançamento manual no formulário de
 *     Nova Publicação Editorial).
 */

import { Holiday, Publication, Priority } from "./types";
import { calculatePlannedDate, formatDateToISO } from "./utils";

// ---------------------------------------------------------------------------
// Cálculo das datas móveis
// ---------------------------------------------------------------------------

/** Domingo de Páscoa (algoritmo anônimo de Butcher/Meeus). */
export function computeEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = Março, 4 = Abril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Última sexta-feira de novembro (Black Friday — feriado municipal de SP). */
function blackFriday(year: number): Date {
  const nov30 = new Date(year, 10, 30);
  const diff = (nov30.getDay() - 5 + 7) % 7; // dias até a última sexta
  return addDays(nov30, -diff);
}

// ---------------------------------------------------------------------------
// Catálogo anual
// ---------------------------------------------------------------------------

export interface BrazilHolidayDef {
  key: string;
  name: string;
  scope: "NACIONAL" | "SP";
  /** Recorrente = mesma data todos os anos (comparada por MM-DD). */
  recurring: boolean;
  /** true quando a data é derivada da Páscoa ou outro cálculo. */
  movable?: boolean;
  /** offset em dias a partir do domingo de Páscoa (movable móvel pascal). */
  easterOffset?: number;
  /** Data fixa (mês 1-12). */
  month?: number;
  day?: number;
  /** Data especial calculada por função própria (ex.: Black Friday). */
  special?: "blackFriday" | "dia-das-maes";
}

/** Domingo de Páscoa — data nacional comemorativa (feriado religioso). */
export function easterSunday(year: number): Date {
  return computeEasterSunday(year);
}

/** Segundo domingo de maio (Dia das Mães). */
function secondSundayOfMonth(year: number, month0: number): Date {
  const first = new Date(year, month0, 1);
  const offset = (7 - first.getDay()) % 7; // dia do primeiro domingo (0-based)
  return new Date(year, month0, 1 + offset + 7);
}

/** Retorna o segundo domingo do mês. */
function secondSundayOfMonth(year: number, month0: number): Date {
  const first = new Date(year, month0, 1);
  const offset = (7 - first.getDay()) % 7;
  return new Date(year, month0, 1 + offset + 7);
}

/** Feriados NACIONAIS do Brasil. */
export const NATIONAL_HOLIDAY_DEFS: BrazilHolidayDef[] = [
  { key: "confraternizacao", name: "Confraternização Universal", scope: "NACIONAL", recurring: true, month: 1, day: 1 },
  { key: "pascoa", name: "Páscoa", scope: "NACIONAL", recurring: false, movable: true, easterOffset: 0 },
  { key: "sexta-santa", name: "Sexta-feira Santa (Paixão de Cristo)", scope: "NACIONAL", recurring: false, movable: true, easterOffset: -2 },
  { key: "tiradentes", name: "Tiradentes", scope: "NACIONAL", recurring: true, month: 4, day: 21 },
  { key: "trabalho", name: "Dia do Trabalho", scope: "NACIONAL", recurring: true, month: 5, day: 1 },
  { key: "dia-das-maes", name: "Dia das Mães", scope: "NACIONAL", recurring: false, special: "dia-das-maes" },
  { key: "corpus-christi", name: "Corpus Christi", scope: "NACIONAL", recurring: false, movable: true, easterOffset: 60 },
  { key: "dia-das-pais", name: "Dia das Pais", scope: "NACIONAL", recurring: false, special: "dia-das-pais" },
  { key: "independencia", name: "Independência do Brasil", scope: "NACIONAL", recurring: true, month: 9, day: 7 },
  { key: "aparecida", name: "Nossa Senhora Aparecida", scope: "NACIONAL", recurring: true, month: 10, day: 12 },
  { key: "finados", name: "Finados", scope: "NACIONAL", recurring: true, month: 11, day: 2 },
  { key: "proclamacao", name: "Proclamação da República", scope: "NACIONAL", recurring: true, month: 11, day: 15 },
  { key: "consciencia-negra", name: "Dia Nacional de Zumbi e da Consciência Negra", scope: "NACIONAL", recurring: true, month: 11, day: 20 },
  { key: "natal", name: "Natal", scope: "NACIONAL", recurring: true, month: 12, day: 25 },
];

/** Feriados da cidade de São Paulo (Capital) e do estado de SP. */
export const SAO_PAULO_HOLIDAY_DEFS: BrazilHolidayDef[] = [
  { key: "carnaval-seg", name: "Carnaval (Segunda-feira)", scope: "SP", recurring: false, movable: true, easterOffset: -48 },
  { key: "carnaval-ter", name: "Carnaval (Terça-feira)", scope: "SP", recurring: false, movable: true, easterOffset: -47 },
  { key: "cinzas", name: "Quarta-feira de Cinzas (ponto facultativo até 14h)", scope: "SP", recurring: false, movable: true, easterOffset: -46 },
  { key: "revolucao-sp", name: "Revolução Constitucionalista de 1932", scope: "SP", recurring: true, month: 7, day: 9 },
  { key: "aniversario-sp", name: "Aniversário da Cidade de São Paulo", scope: "SP", recurring: true, month: 1, day: 25 },
  { key: "black-friday", name: "Black Friday (feriado municipal em SP)", scope: "SP", recurring: false, special: "blackFriday" },
];

/** Datas comemorativas nacionais (não são feriado oficial, mas entram no calendário). */
export const COMMEMORATIVE_DATE_DEFS: BrazilHolidayDef[] = [
  { key: "dia-internacional-mulher", name: "Dia Internacional da Mulher", scope: "NACIONAL", recurring: true, month: 3, day: 8 },
];

export const ALL_BRAZIL_HOLIDAY_DEFS: BrazilHolidayDef[] = [
  ...NATIONAL_HOLIDAY_DEFS,
  ...SAO_PAULO_HOLIDAY_DEFS,
  ...COMMEMORATIVE_DATE_DEFS,
];

/** Resolve a data concreta de um feriado do catálogo em um determinado ano. */
export function resolveBrazilHolidayDate(def: BrazilHolidayDef, year: number): Date {
  if (def.special === "blackFriday") return blackFriday(year);
  if (def.special === "dia-das-maes") return secondSundayOfMonth(year, 4); // maio
  if (def.special === "dia-das-pais") return secondSundayOfMonth(year, 7); // Agosto
  if (def.movable && typeof def.easterOffset === "number") {
    return addDays(computeEasterSunday(year), def.easterOffset);
  }
  return new Date(year, (def.month ?? 1) - 1, def.day ?? 1);
}

/**
 * Lista completa dos feriados (nacionais + SP Capital) de um ano, prontos
 * para uso no calendário. Ids estáveis (`auto-{ano}-{key}`) permitem
 * deduplicação e exclusão individual pelo usuário.
 */
export function listBrazilHolidays(year: number): Holiday[] {
  return ALL_BRAZIL_HOLIDAY_DEFS.map((def) => ({
    id: `auto-${year}-${def.key}`,
    name: def.name,
    date: formatDateToISO(resolveBrazilHolidayDate(def, year)),
    year,
    type: def.scope === "NACIONAL" ? ("NACIONAL" as const) : ("ESCOLAR" as const),
    recurring: def.recurring,
  })).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Datas comemorativas (Páscoa, Dia das Mães, Dia Internacional da Mulher…) —
 * NÃO são dias não-úteis, por isso ficam fora do cálculo de produção e dos
 * feriados automáticos. São exibidas apenas como referência no calendário.
 */
export function listCommemorativeDates(year: number): Holiday[] {
  return COMMEMORATIVE_DATE_DEFS.map((def) => ({
    id: `auto-${year}-${def.key}`,
    name: def.name,
    date: formatDateToISO(resolveBrazilHolidayDate(def, year)),
    year,
    type: "FACULTATIVO" as const,
    recurring: def.recurring,
  })).sort((a, b) => a.date.localeCompare(b.date));
}

/** Feriados que afetam dias úteis (exclui as datas comemorativas). */
export function listWorkingDayHolidays(year: number): Holiday[] {
  return listBrazilHolidays(year).filter(
    (h) => !COMMEMORATIVE_DATE_DEFS.some((d) => `auto-${year}-${d.key}` === h.id)
  );
}

// ---------------------------------------------------------------------------
// Publicações da categoria "Feriados" (geração automática)
// ---------------------------------------------------------------------------

export const FERIADOS_CATEGORY_ID = "FERIADOS";
const FERIADO_TAG = "feriado-automatico";

/** Constrói a publicação (sem id) de um feriado do catálogo. */
export function buildFeriadoPublication(
  def: BrazilHolidayDef,
  year: number,
  holidays: Holiday[],
  productionDays: number = 5
): Omit<Publication, "id"> {
  const publicationDate = formatDateToISO(resolveBrazilHolidayDate(def, year));
  return {
    title: def.name,
    description: `Feriado ${def.scope === "NACIONAL" ? "nacional" : "de São Paulo"} — gerado automaticamente (${publicationDate.split("-").reverse().join("/")}/${String(year)}).`,
    categoryId: FERIADOS_CATEGORY_ID,
    status: "PLANEJAMENTO",
    priority: (def.scope === "NACIONAL" ? "MEDIA" : "BAIXA") as Priority,
    publicationDate,
    plannedDate: calculatePlannedDate(publicationDate, productionDays, holidays),
    productionDays,
    tags: [FERIADO_TAG, "plano-anual", `key:${def.key}`],
  };
}

/**
 * Publicações das datas comemorativas (Páscoa, Dia das Mães, Dia
 * Internacional da Mulher…) — categoria RT Publicity, pois são pautas de
 * conteúdo/engajamento que não envolvem produção em dias não-úteis.
 */
export function buildCommemorativePublication(
  def: BrazilHolidayDef,
  year: number,
  holidays: Holiday[],
  productionDays: number = 5
): Omit<Publication, "id"> {
  const pub = buildFeriadoPublication(def, year, holidays, productionDays);
  return {
    ...pub,
    categoryId: "RT_PUBLICITY",
    description: `Data comemorativa — gerada automaticamente (${pub.publicationDate.split("-").reverse().join("/")}/${String(year)}).`,
    tags: [FERIADO_TAG, "plano-anual", "data-comemorativa", `key:${def.key}`],
  };
}

/** Keys dos feriados já lançados no ano (para não duplicar na geração). */
export function getExistingFeriadoKeys(publications: Publication[], year: number): Set<string> {
  const set = new Set<string>();
  for (const p of publications) {
    if (
      !p.isDeleted &&
      (p.categoryId === FERIADOS_CATEGORY_ID || p.categoryId === "RT_PUBLICITY") &&
      p.publicationDate.startsWith(String(year))
    ) {
      const tagKey = p.tags?.find((t) => t.startsWith("key:"));
      if (tagKey) set.add(tagKey.substring(4));
      else set.add(`date:${p.publicationDate}`);
    }
  }
  return set;
}

/**
 * Keys de feriados/datas comemorativas que o usuário EXCLUIU manualmente.
 * A geração automática respeita essa lista: uma vez removida (ex.: "Dia das
 * Mulheres" da RT Publicity), a publicação NÃO volta a ser recriada ao
 * atualizar/recarregar o sistema — nem para aquele ano, nem nos demais.
 */
export function getSuppressedFeriadoKeys(publications: Publication[]): Set<string> {
  const set = new Set<string>();
  for (const p of publications) {
    if (!p.isDeleted) continue;
    if (p.categoryId !== FERIADOS_CATEGORY_ID && p.categoryId !== "RT_PUBLICITY") continue;
    const tagKey = p.tags?.find((t) => t.startsWith("key:"));
    if (tagKey) set.add(tagKey.substring(4));
    else set.add(`date:${p.publicationDate}`);
  }
  return set;
}

/**
 * Gera as publicações dos feriados do ano que ainda não existem.
 * Feriados são lançados automaticamente — não precisam ser cadastrados
 * manualmente no formulário de Nova Publicação Editorial.
 * Datas comemorativas (Páscoa, Dia das Mães, Dia Internacional da Mulher…)
 * entram como publicações RT Publicity.
 */
export function generateFeriadoPublications(
  year: number,
  existingPublications: Publication[],
  holidays: Holiday[],
  /** Keys suprimidas manualmente (excluídas pelo usuário) — nunca recriar. */
  suppressed?: Set<string>
): Omit<Publication, "id">[] {
  const existing = getExistingFeriadoKeys(existingPublications, year);
  const missingDefs = ALL_BRAZIL_HOLIDAY_DEFS.filter((def) => {
    if (suppressed?.has(def.key)) return false;
    if (existing.has(def.key)) return false;
    const dateKey = `date:${formatDateToISO(resolveBrazilHolidayDate(def, year))}`;
    if (existing.has(dateKey)) return false;
    // Feriado excluído manualmente em qualquer ano não volta mais.
    if (suppressed?.has(dateKey)) return false;
    return true;
  });
  return missingDefs.map((def) => {
    const isCommemorative = COMMEMORATIVE_DATE_DEFS.some((d) => d.key === def.key);
    // Cálculo de dias úteis ignora apenas os feriados que realmente afetam a
    // produção (datas comemorativas não param o calendário letivo).
    const workingDayHolidays = holidays.filter(
      (h) => !COMMEMORATIVE_DATE_DEFS.some((d) => h.id === `auto-${year}-${d.key}`)
    );
    return isCommemorative
      ? buildCommemorativePublication(def, year, workingDayHolidays)
      : buildFeriadoPublication(def, year, workingDayHolidays);
  });
}
