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
  special?: "blackFriday";
}

/** Feriados NACIONAIS do Brasil. */
export const NATIONAL_HOLIDAY_DEFS: BrazilHolidayDef[] = [
  { key: "confraternizacao", name: "Confraternização Universal", scope: "NACIONAL", recurring: true, month: 1, day: 1 },
  { key: "sexta-santa", name: "Sexta-feira Santa (Paixão de Cristo)", scope: "NACIONAL", recurring: false, movable: true, easterOffset: -2 },
  { key: "tiradentes", name: "Tiradentes", scope: "NACIONAL", recurring: true, month: 4, day: 21 },
  { key: "trabalho", name: "Dia do Trabalho", scope: "NACIONAL", recurring: true, month: 5, day: 1 },
  { key: "corpus-christi", name: "Corpus Christi", scope: "NACIONAL", recurring: false, movable: true, easterOffset: 60 },
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

export const ALL_BRAZIL_HOLIDAY_DEFS: BrazilHolidayDef[] = [
  ...NATIONAL_HOLIDAY_DEFS,
  ...SAO_PAULO_HOLIDAY_DEFS,
];

/** Resolve a data concreta de um feriado do catálogo em um determinado ano. */
export function resolveBrazilHolidayDate(def: BrazilHolidayDef, year: number): Date {
  if (def.special === "blackFriday") return blackFriday(year);
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

/** Keys dos feriados já lançados no ano (para não duplicar na geração). */
export function getExistingFeriadoKeys(publications: Publication[], year: number): Set<string> {
  const set = new Set<string>();
  for (const p of publications) {
    if (
      !p.isDeleted &&
      p.categoryId === FERIADOS_CATEGORY_ID &&
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
 * Gera as publicações dos feriados do ano que ainda não existem.
 * Feriados são lançados automaticamente — não precisam ser cadastrados
 * manualmente no formulário de Nova Publicação Editorial.
 */
export function generateFeriadoPublications(
  year: number,
  existingPublications: Publication[],
  holidays: Holiday[]
): Omit<Publication, "id">[] {
  const existing = getExistingFeriadoKeys(existingPublications, year);
  return ALL_BRAZIL_HOLIDAY_DEFS.filter(
    (def) =>
      !existing.has(def.key) &&
      !existing.has(
        `date:${formatDateToISO(resolveBrazilHolidayDate(def, year))}`
      )
  ).map((def) => buildFeriadoPublication(def, year, holidays));
}
