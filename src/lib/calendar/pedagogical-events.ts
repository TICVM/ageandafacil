import { Holiday, Publication, PublicationStatus, Priority } from "./types";
import {
  formatDateToISO,
  isBusinessDay,
  calculatePlannedDate,
} from "./utils";

/**
 * Plano Anual de Eventos Pedagógicos — geração SEMI-AUTOMÁTICA.
 *
 * O catálogo abaixo lista os eventos que se repetem todos os anos na escola.
 * Para cada ano escolhido, o gerador calcula automaticamente a data de cada
 * evento:
 *   - Datas FIXAS (dia/mês) são usadas diretamente (ex.: Dia das Mulheres 08/03).
 *   - Datas MÓVEIS derivam de cálculos religiosos/calendário escolar
 *     (Carnaval e Páscoa via algoritmo de Easter; Corpus Christi = Páscoa+60;
 *      Dia das Mães/Pais = 2º domingo de maio/agosto; etc.).
 *   - EVENTOS EM JANELA ("range") caem no meio do período informado
 *     (ex.: Reuniões de Pais, Férias de Julho, Plantões de Matrícula).
 *   - Se a data calculada cair em fim de semana ou feriado cadastrado,
 *     ela é deslocada para o próximo dia útil (exceto "keepDate" — eventos
 *     cuja data é simbólica, como Dia das Mulheres, que permanecem na data).
 *
 * O usuário revisa a prévia no modal e pode ajustar/ocultar eventos antes de
 * confirmar; por isso a geração é "semi-automática".
 */

export type EventDateRule =
  | { kind: "fixed"; month: number; day: number } // month: 1-12
  | { kind: "easter"; offsetDays: number } // Páscoa + offset (negativo = antes)
  | { kind: "nthWeekday"; month: number; weekday: number; nth: number } // 1-based; weekday 0=Dom
  | { kind: "lastWeekday"; month: number; weekday: number }
  | { kind: "firstBusinessDay"; month: number }
  | { kind: "range"; startMonth: number; startDay: number; endMonth: number; endDay: number }
  /**
   * Lista EXPLÍCITA de dias do mês — gera uma publicação por dia informado.
   * Usado por eventos de vários dias como a CVM Education Week
   * (19, 20, 21, 22, 23, 26, 27, 28, 29 e 30 de janeiro).
   */
  | { kind: "businessDaysInPeriod"; month: number; days: number[] };

export interface PedagogicalEventDef {
  key: string;
  title: string;
  rule: EventDateRule;
  seriesId?: string;
  priority: Priority;
  /** true = mantém a data mesmo em fim de semana/feriado (data simbólica) */
  keepDate?: boolean;
  description?: string;
  /**
   * true = evento de vários dias (regra "businessDaysInPeriod") — o gerador
   * cria uma publicação por dia e a prévia exibe todos os dias do período.
   */
  multiDay?: boolean;
}

// ---------------------------------------------------------------------------
// Catálogo anual (ordem cronológica aproximada do ano letivo)
// ---------------------------------------------------------------------------
export const ANNUAL_PEDAGOGICAL_EVENTS: PedagogicalEventDef[] = [
  {
    key: "cvm-education-week",
    title: "CVM Education Week",
    // Dias 19, 20, 21, 22, 23, 26, 27, 28, 29 e 30 de janeiro — uma
    // publicação por dia (os fins de semana dentro do período são pulados).
    rule: { kind: "businessDaysInPeriod", month: 1, days: [19, 20, 21, 22, 23, 26, 27, 28, 29, 30] },
    priority: "ALTA",
    multiDay: true,
    description:
      "Semana pedagógica de abertura do ano letivo — formação e planejamento dos professores (19 a 30 de janeiro).",
  },
  {
    key: "volta-as-aulas",
    title: "Volta às Aulas",
    rule: { kind: "firstBusinessDay", month: 2 },
    priority: "ALTA",
    description: "Abertura do ano letivo — acolhida dos alunos.",
  },
  {
    key: "baile-carnaval",
    title: "Baile de Carnaval",
    rule: { kind: "easter", offsetDays: -52 }, // sexta-feira de Carnaval
    priority: "MEDIA",
    description: "Festa de carnaval da escola.",
  },
  {
    key: "dia-das-mulheres",
    title: "Dia das Mulheres",
    rule: { kind: "fixed", month: 3, day: 8 },
    priority: "MEDIA",
    keepDate: true,
    description: "Homenagem alusiva ao Dia Internacional da Mulher.",
  },
  {
    key: "dia-do-circo",
    title: "Dia do Circo",
    rule: { kind: "fixed", month: 3, day: 27 },
    priority: "BAIXA",
    keepDate: true,
    description: "Comemoração do Dia Nacional do Circo.",
  },
  {
    key: "sorteio-de-premios",
    title: "Sorteio de Prêmios",
    rule: { kind: "range", startMonth: 3, startDay: 10, endMonth: 3, endDay: 25 },
    priority: "ALTA",
    description: "Campanha de sorteio de prêmios para alunos e famílias.",
  },
  {
    key: "olimpiadas-do-conhecimento",
    title: "Olimpíadas do Conhecimento",
    rule: { kind: "range", startMonth: 3, startDay: 20, endMonth: 4, endDay: 15 },
    priority: "ALTA",
    description: "Competição interdisciplinar de conhecimento entre turmas.",
  },
  {
    key: "pascoa",
    title: "Páscoa",
    rule: { kind: "easter", offsetDays: 0 },
    priority: "MEDIA",
    keepDate: true,
    description: "Data da Páscoa (domingo), com programação especial na escola.",
  },
  {
    key: "reuniao-pais-1t",
    title: "1ª Reunião de Pais",
    rule: { kind: "nthWeekday", month: 3, weekday: 6, nth: 2 }, // 2º domingo de março
    priority: "ALTA",
    description: "Primeira reunião de pais e mestres do ano.",
  },
  {
    key: "dia-das-maes",
    title: "Dia das Mães",
    rule: { kind: "nthWeekday", month: 5, weekday: 0, nth: 2 }, // 2º domingo de maio
    priority: "ALTA",
    keepDate: true,
    description: "Comemoração e homenagem às mães.",
  },
  {
    key: "cvmun",
    title: "CVMUN",
    rule: { kind: "range", startMonth: 5, startDay: 15, endMonth: 6, endDay: 10 },
    priority: "ALTA",
    description: "Model United Nations do CVM — simulação da ONU.",
  },
  {
    key: "aluno-nota-10-t1",
    title: "Aluno Nota 10",
    rule: { kind: "range", startMonth: 4, startDay: 1, endMonth: 4, endDay: 30 },
    seriesId: "MEDIO_3",
    priority: "MEDIA",
    description: "Premiação mensal do Aluno Nota 10.",
  },
  {
    key: "voce-e-fera-t1",
    title: "Você é Fera! (Patinhas)",
    rule: { kind: "range", startMonth: 4, startDay: 1, endMonth: 4, endDay: 30 },
    seriesId: "MATERNAL",
    priority: "MEDIA",
    description: "Reconhecimento 'Você é Fera' — projeto Patinhas.",
  },
  {
    key: "cvm-artes-t1",
    title: "CVM Artes",
    rule: { kind: "range", startMonth: 4, startDay: 1, endMonth: 4, endDay: 30 },
    priority: "MEDIA",
    description: "Mostra de artes dos alunos do CVM.",
  },
  {
    key: "matriculas-meio-de-ano",
    title: "Campanha de Matrículas de Meio de Ano",
    rule: { kind: "range", startMonth: 5, startDay: 1, endMonth: 5, endDay: 31 },
    priority: "URGENTE",
    description: "Divulgação das vagas e campanhas de matrícula para o 2º semestre.",
  },
  {
    key: "festa-junina",
    title: "Festa Junina",
    rule: { kind: "range", startMonth: 6, startDay: 10, endMonth: 6, endDay: 28 },
    priority: "ALTA",
    description: "Arraiá do CVM — festa junina escolar.",
  },
  {
    key: "ferias-escolares-julho",
    title: "Férias de Julho",
    rule: { kind: "fixed", month: 7, day: 1 },
    priority: "BAIXA",
    keepDate: true,
    description: "Início das férias escolares de meio de ano (01/07).",
  },
  {
    key: "volta-as-aulas-2-semestre",
    title: "Volta às Aulas — 2º Semestre",
    rule: { kind: "fixed", month: 8, day: 3 },
    priority: "ALTA",
    keepDate: true,
    description: "Retomada das aulas do 2º semestre (03/08).",
  },
  {
    key: "dia-dos-pais",
    title: "Dia dos Pais",
    rule: { kind: "nthWeekday", month: 8, weekday: 0, nth: 2 }, // 2º domingo de agosto
    priority: "ALTA",
    keepDate: true,
    description: "Comemoração e homenagem aos pais.",
  },
  {
    key: "rematriculas",
    title: "Rematrículas",
    rule: { kind: "range", startMonth: 8, startDay: 1, endMonth: 8, endDay: 31 },
    priority: "URGENTE",
    description: "Período de rematrícula dos alunos atuais.",
  },
  {
    key: "portas-abertas-cvm",
    title: "Portas Abertas CVM",
    rule: { kind: "range", startMonth: 9, startDay: 1, endMonth: 9, endDay: 30 },
    priority: "ALTA",
    description: "Evento Portas Abertas CVM — visitação e captação de novos alunos.",
  },
  {
    key: "aluno-nota-10-t2",
    title: "Aluno Nota 10",
    rule: { kind: "range", startMonth: 8, startDay: 1, endMonth: 8, endDay: 31 },
    seriesId: "MEDIO_3",
    priority: "MEDIA",
    description: "Premiação mensal do Aluno Nota 10.",
  },
  {
    key: "voce-e-fera-t2",
    title: "Você é Fera! (Patinhas)",
    rule: { kind: "range", startMonth: 8, startDay: 1, endMonth: 8, endDay: 31 },
    seriesId: "MATERNAL",
    priority: "MEDIA",
    description: "Reconhecimento 'Você é Fera' — projeto Patinhas.",
  },
  {
    key: "cvm-artes-t2",
    title: "CVM Artes",
    rule: { kind: "range", startMonth: 8, startDay: 1, endMonth: 8, endDay: 31 },
    priority: "MEDIA",
    description: "Mostra de artes dos alunos do CVM.",
  },
  {
    key: "reuniao-pais-2t",
    title: "Reunião de Pais 2º Trimestre",
    rule: { kind: "nthWeekday", month: 8, weekday: 6, nth: 2 }, // 2º domingo de agosto
    priority: "ALTA",
    description: "Entrega de boletins e balanço do 2º trimestre.",
  },
  {
    key: "matriculas",
    title: "Matrículas",
    rule: { kind: "range", startMonth: 9, startDay: 1, endMonth: 10, endDay: 31 },
    priority: "URGENTE",
    description: "Abertura do período de matrículas para o ano seguinte.",
  },
  {
    key: "dia-do-estudante",
    title: "Dia do Estudante",
    rule: { kind: "fixed", month: 8, day: 11 },
    priority: "MEDIA",
    keepDate: true,
    description: "Comemoração alusiva ao Dia do Estudante.",
  },
  {
    key: "fundacao-cvm",
    title: "Data de Fundação do CVM",
    rule: { kind: "fixed", month: 9, day: 15 },
    priority: "ALTA",
    keepDate: true,
    description: "Aniversário de fundação do Colégio Villa-Mestre.",
  },
  {
    key: "speeling-bee",
    title: "Spelling Bee",
    rule: { kind: "range", startMonth: 9, startDay: 10, endMonth: 10, endDay: 10 },
    priority: "ALTA",
    description: "Concurso de soletração em inglês do Programa Bilíngue.",
  },
  {
    key: "dia-dos-professores",
    title: "Dia dos Professores",
    rule: { kind: "fixed", month: 10, day: 15 },
    priority: "ALTA",
    keepDate: true,
    description: "Homenagem aos professores.",
  },
  {
    key: "dia-das-criancas",
    title: "Dia das Crianças",
    rule: { kind: "fixed", month: 10, day: 12 },
    priority: "MEDIA",
    keepDate: true,
    description: "Comemoração do Dia das Crianças.",
  },
  {
    key: "cvm-cultural",
    title: "CVM Cultural",
    rule: { kind: "range", startMonth: 10, startDay: 15, endMonth: 11, endDay: 15 },
    priority: "ALTA",
    description: "Semana cultural com apresentações e exposições.",
  },
  {
    key: "costume-party",
    title: "Costume Party",
    rule: { kind: "range", startMonth: 10, startDay: 20, endMonth: 11, endDay: 5 },
    priority: "MEDIA",
    description: "Festa à fantasia do Programa Bilíngue (Halloween).",
  },
  {
    key: "aluno-nota-10-t3",
    title: "Aluno Nota 10",
    rule: { kind: "range", startMonth: 11, startDay: 1, endMonth: 11, endDay: 30 },
    seriesId: "MEDIO_3",
    priority: "MEDIA",
    description: "Premiação mensal do Aluno Nota 10.",
  },
  {
    key: "voce-e-fera-t3",
    title: "Você é Fera! (Patinhas)",
    rule: { kind: "range", startMonth: 11, startDay: 1, endMonth: 11, endDay: 30 },
    seriesId: "MATERNAL",
    priority: "MEDIA",
    description: "Reconhecimento 'Você é Fera' — projeto Patinhas.",
  },
  {
    key: "cvm-artes-t3",
    title: "CVM Artes",
    rule: { kind: "range", startMonth: 11, startDay: 1, endMonth: 11, endDay: 30 },
    priority: "MEDIA",
    description: "Mostra de artes dos alunos do CVM.",
  },
  {
    key: "quinzena-transicao-5ano",
    title: "Quinzena de Transição 5º Ano",
    rule: { kind: "range", startMonth: 11, startDay: 10, endMonth: 11, endDay: 30 },
    seriesId: "ANO_5",
    priority: "MEDIA",
    description: "Acolhimento e transição dos alunos do 5º Ano para o Fundamental II.",
  },
  {
    key: "acampadentro",
    title: "Acampadentro",
    rule: { kind: "range", startMonth: 11, startDay: 15, endMonth: 12, endDay: 10 },
    priority: "MEDIA",
    description: "Acampamento interno da Educação Infantil/Fundamental I.",
  },
  {
    key: "reuniao-pais-3t",
    title: "Reunião de Pais 3º Trimestre",
    rule: { kind: "nthWeekday", month: 11, weekday: 6, nth: 1 }, // 1º domingo de novembro
    priority: "ALTA",
    description: "Balanço e fechamento do 3º trimestre.",
  },
  {
    key: "formatura-pre",
    title: "Formatura Pré",
    rule: { kind: "range", startMonth: 12, startDay: 1, endMonth: 12, endDay: 15 },
    seriesId: "PRE",
    priority: "ALTA",
    description: "Cerimônia de formatura da Educação Infantil (Pré).",
  },
  {
    key: "formatura-3-medio",
    title: "Formatura 3º Médio",
    rule: { kind: "range", startMonth: 12, startDay: 1, endMonth: 12, endDay: 20 },
    seriesId: "MEDIO_3",
    priority: "URGENTE",
    description: "Cerimônia de colação de grau do 3º Ano do Ensino Médio.",
  },
  {
    key: "ferias-final-de-ano",
    title: "Férias de Final de Ano",
    rule: { kind: "fixed", month: 12, day: 1 },
    priority: "BAIXA",
    keepDate: true,
    description: "Início das férias escolares de fim de ano (01/12).",
  },
];

// ---------------------------------------------------------------------------
// Cálculo de datas
// ---------------------------------------------------------------------------

/** Domingo de Páscoa (algoritmo anônimo de Butcher/Meeus) */
export function computeEaster(year: number): Date {
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
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=Mar, 4=Abr
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number): Date {
  const first = new Date(year, month - 1, 1);
  const diff = (weekday - first.getDay() + 7) % 7;
  return addDays(first, diff + (nth - 1) * 7);
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const last = new Date(year, month, 0); // último dia do mês
  const diff = (last.getDay() - weekday + 7) % 7;
  return addDays(last, -diff);
}

function midpointOfRange(
  year: number,
  sM: number,
  sD: number,
  eM: number,
  eD: number
): Date {
  const start = new Date(year, sM - 1, sD);
  const end = new Date(year, eM - 1, eD);
  const mid = new Date(Math.floor((start.getTime() + end.getTime()) / 2));
  return mid;
}

/** Resolve a regra de data para uma data concreta no ano informado. */
export function resolveEventDate(def: PedagogicalEventDef, year: number): Date {
  const r = def.rule;
  switch (r.kind) {
    case "fixed":
      return new Date(year, r.month - 1, r.day);
    case "easter":
      return addDays(computeEaster(year), r.offsetDays);
    case "nthWeekday":
      return nthWeekdayOfMonth(year, r.month, r.weekday, r.nth);
    case "lastWeekday":
      return lastWeekdayOfMonth(year, r.month, r.weekday);
    case "firstBusinessDay": {
      let d = new Date(year, r.month - 1, 1);
      for (let guard = 0; guard < 40 && (d.getDay() === 0 || d.getDay() === 6); guard++) {
        d = addDays(d, 1);
      }
      return d;
    }
    case "range":
      return midpointOfRange(year, r.startMonth, r.startDay, r.endMonth, r.endDay);
    case "businessDaysInPeriod": {
      // Primeira data do período que seja dia útil (sáb/dom são pulados).
      for (const day of [...r.days].sort((a, b) => a - b)) {
        const d = new Date(year, r.month - 1, day);
        if (d.getDay() !== 0 && d.getDay() !== 6) return d;
      }
      return new Date(year, r.month - 1, r.days[0] ?? 1);
    }
  }
}

/**
 * Todas as datas de um evento multi-dia (regra "businessDaysInPeriod"),
 * pulando sábado/domingo e feriados cadastrados — ex.: CVM Education Week
 * gera uma publicação para cada dia: 19, 20, 21, 22, 23, 26, 27, 28, 29 e 30.
 */
export function resolveEventDatesList(
  def: PedagogicalEventDef,
  year: number,
  holidays: Holiday[]
): Date[] {
  const r = def.rule;
  if (r.kind !== "businessDaysInPeriod") return [resolveEventDate(def, year)];
  const out: Date[] = [];
  for (const day of [...r.days].sort((a, b) => a - b)) {
    const d = new Date(year, r.month - 1, day);
    if (isBusinessDay(d, holidays)) out.push(d);
  }
  return out;
}

/** Desloca para o próximo dia útil (se não for keepDate). */
function adjustToBusinessDay(date: Date, holidays: Holiday[], keepDate?: boolean): Date {
  if (keepDate) return date;
  let cursor = new Date(date);
  for (let guard = 0; guard < 30 && !isBusinessDay(cursor, holidays); guard++) {
    cursor = addDays(cursor, 1);
  }
  return cursor;
}

export interface ResolvedPedagogicalEvent extends PedagogicalEventDef {
  date: string; // YYYY-MM-DD (já ajustada)
  originalDate: string; // YYYY-MM-DD (antes do ajuste)
  wasAdjusted: boolean;
}

/** Calcula todas as datas dos eventos recorrentes para o ano informado. */
export function resolveAnnualEvents(
  year: number,
  holidays: Holiday[],
  defs: PedagogicalEventDef[] = ANNUAL_PEDAGOGICAL_EVENTS
): ResolvedPedagogicalEvent[] {
  const out: ResolvedPedagogicalEvent[] = [];
  for (const def of defs) {
    const raw = resolveEventDate(def, year);
    const adjusted = adjustToBusinessDay(raw, holidays, def.keepDate);
    const originalDate = formatDateToISO(raw);
    const date = formatDateToISO(adjusted);
    out.push({ ...def, date, originalDate, wasAdjusted: date !== originalDate });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Estável id por ano+key — permite detectar duplicatas e substituir sem apagar edições. */
export function pedagogicalStableId(year: number, key: string): string {
  return `ped-${year}-${key}`;
}

const PED_TAG = "evento-pedagogico";
const CAT_ID = "EVENTOS_PEDAGOGICOS";

/** Constrói a publicação (sem id) de um evento já resolvido. */
export function buildEventPublication(
  ev: ResolvedPedagogicalEvent,
  holidays: Holiday[],
  productionDays: number = 7
): Omit<Publication, "id"> {
  // Eventos multi-dia (ex.: CVM Education Week) recebem sufixo com o dia,
  // para diferenciar as publicações geradas (uma por dia do período).
  const isMultiDayOccurrence =
    ev.multiDay && !/^Dia \d+/.test(ev.title ?? "");
  const title = isMultiDayOccurrence
    ? `${ev.title} — Dia ${Number(ev.date.slice(8, 10))}`
    : ev.title;
  return {
    title,
    description: ev.description ?? "Evento pedagógico recorrente do plano anual.",
    categoryId: CAT_ID,
    seriesId: ev.seriesId,
    status: "PLANEJAMENTO" as PublicationStatus,
    priority: ev.priority as Priority,
    publicationDate: ev.date,
    plannedDate: calculatePlannedDate(ev.date, productionDays, holidays),
    productionDays,
    tags: [PED_TAG, "plano-anual", `key:${ev.key}`],
  };
}

/**
 * Expande a lista de eventos resolvidos em uma entrada POR DIA para os
 * eventos multi-dia (regra "businessDaysInPeriod"). Ex.: CVM Education Week
 * vira 10 publicações — dias 19, 20, 21, 22, 23, 26, 27, 28, 29 e 30 de
 * janeiro (pulando fins de semana/feriados que caírem dentro do período).
 */
export function expandMultiDayEvents(
  events: ResolvedPedagogicalEvent[],
  year: number,
  holidays: Holiday[]
): ResolvedPedagogicalEvent[] {
  const out: ResolvedPedagogicalEvent[] = [];
  for (const ev of events) {
    if (!ev.multiDay || ev.rule.kind !== "businessDaysInPeriod") {
      out.push(ev);
      continue;
    }
    const dates = resolveEventDatesList(ev, year, holidays);
    for (const d of dates) {
      const date = formatDateToISO(d);
      out.push({ ...ev, date, originalDate: date, wasAdjusted: false });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Detecta publicações de eventos pedagógicos antigas do ano (para substituição). */
export function findOutdatedPedagogicalGenerated(
  existing: Publication[],
  year: number
): Publication[] {
  return existing.filter(
    (p) =>
      !p.isDeleted &&
      p.categoryId === CAT_ID &&
      p.tags?.includes(PED_TAG) &&
      p.publicationDate.startsWith(String(year))
  );
}

/** Retorna as keys de eventos já existentes no ano (não apagadas). */
export function getExistingEventKeys(publications: Publication[], year: number): Set<string> {
  const set = new Set<string>();
  for (const p of publications) {
    if (
      !p.isDeleted &&
      p.categoryId === CAT_ID &&
      p.tags?.includes(PED_TAG) &&
      p.publicationDate.startsWith(String(year))
    ) {
      const tagKey = p.tags?.find((t) => t.startsWith("key:"));
      if (tagKey) set.add(tagKey.substring(4));
    }
  }
  return set;
}
