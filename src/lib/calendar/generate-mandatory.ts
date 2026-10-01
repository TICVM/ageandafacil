import { Publication, Holiday, PublicationStatus, Priority } from "./types";
import { formatDateToISO, parseDateString, isBusinessDay, calculatePlannedDate } from "./utils";
import { DEFAULT_PRODUCTION_DEADLINES } from "./constants";

/**
 * Geração automática das publicações obrigatórias por Série Escolar.
 *
 * Regras:
 *  - Atividades Variadas: 1 publicação por série (Maternal ao 3º Médio) = 15
 *  - Programa Bilíngue:   1 publicação por série (Maternal ao 9º Ano)    = 12
 *  - Total: 27 publicações obrigatórias, no máximo 1 por semana, até setembro
 *  - Ritmo de intercalação balanceado ~2:1 — a cada 2 publicações de
 *    Atividades Variadas vem 1 do Programa Bilíngue, com os slots de PB
 *    distribuídos uniformemente por todo o plano (não concentrados no início).
 *    Como são 15 AV e 12 PB (27 no total), o cálculo coloca um PB a cada
 *    round(27 / 12) ≈ 2 posições. Ex.:
 *      Maternal  → Atividades Variadas  (08/02)
 *      Jardim    → Atividades Variadas  (16/02)
 *      9º Ano    → Programa Bilíngue    (24/02)
 *      Pré       → Atividades Variadas  (02/03)
 *      1º Ano    → Atividades Variadas  (09/03)
 *      8º Ano    → Programa Bilíngue    (16/03) …
 *    No fim não sobra uma "cauda" só de PB nem só de AV: as duas categorias
 *    ficam intercaladas até a última semana.
 *  - AV percorre as séries de Maternal ao 3º Médio; PB percorre na direção
 *    oposta (9º Ano → Maternal). O usuário pode inverter essa direção.
 *  - Como o ritmo é 2:1, uma série jamais aparece em AV e PB em semanas
 *    seguidas (entre as duas sempre há pelo menos 2 outras publicações).
 *  - Datas distribuídas entre os dias úteis (Seg→Sex rotativo), nunca em
 *    finais de semana nem feriados (usa os feriados cadastrados)
 *  - Sem título e com status "PLANEJAMENTO"
 */

/** Direção da sequência de séries dentro de cada categoria */
export type SeriesOrder = "asc" | "desc";

export interface GenerationOptions {
  year: number;
  /** Data inicial do período (YYYY-MM-DD). Default: 10/fevereiro do ano letivo */
  startDate?: string;
  /** Data final do período (YYYY-MM-DD). Default: 30/setembro */
  endDate?: string;
  /**
   * Ordem das séries em Atividades Variadas.
   *  "asc"  = Maternal → 3º Médio (padrão)
   *  "desc" = 3º Médio → Maternal (invertido)
   */
  avOrder?: SeriesOrder;
  /**
   * Ordem das séries no Programa Bilíngue.
   *  "asc"  = Maternal → 9º Ano
   *  "desc" = 9º Ano → Maternal (padrão — começa pelo 9º Ano)
   */
  pbOrder?: SeriesOrder;
}

export interface GenerationResult {
  publications: Omit<Publication, "id">[];
  skippedWeekendsAndHolidays: number;
  warnings: string[];
}

// Ordem didática completa (usada como referência de sequência das séries)
export const SERIES_AV = [
  "MATERNAL", "JARDIM", "PRE", "ANO_1", "ANO_2", "ANO_3", "ANO_4",
  "ANO_5", "ANO_6", "ANO_7", "ANO_8", "ANO_9", "MEDIO_1", "MEDIO_2", "MEDIO_3",
];

export const SERIES_PB = [
  "MATERNAL", "JARDIM", "PRE", "ANO_1", "ANO_2", "ANO_3", "ANO_4",
  "ANO_5", "ANO_6", "ANO_7", "ANO_8", "ANO_9",
];

function getProductionDays(categoryId: string, seriesId: string): number {
  const match = DEFAULT_PRODUCTION_DEADLINES.find(
    (d) => d.categoryId === categoryId && d.seriesId === seriesId && d.active
  );
  return match ? match.daysBefore : 7;
}

export function generateMandatoryPublications(
  options: GenerationOptions,
  holidays: Holiday[]
): GenerationResult {
  const { year } = options;
  const avOrder: SeriesOrder = options.avOrder ?? "asc";
  const pbOrder: SeriesOrder = options.pbOrder ?? "desc";
  const startDateStr = options.startDate ?? `${year}-02-10`;
  const endDateStr = options.endDate ?? `${year}-09-30`;

  const start = parseDateString(startDateStr);
  // Distribui as publicações ao longo da semana (seg → sex), em vez de
  // concentrar tudo nas segundas-feiras. A cada publicação o dia da semana
  // avança uma posição útil (Seg, Ter, Qua, Qui, Sex, Seg, …).
  let weekdayCursor = 0; // 0 = segunda ... 4 = sexta
  const advanceWeekday = () => {
    weekdayCursor = (weekdayCursor + 1) % 5;
  };
  /** Move a data para o n-ésimo dia útil da semana (a partir de segunda) */
  const alignToNthBusinessDay = (d: Date): Date => {
    const target = weekdayCursor;
    let businessSeen = 0;
    const probe = new Date(d);
    // volta até a segunda-feira da semana
    probe.setDate(probe.getDate() - ((probe.getDay() + 6) % 7));
    while (businessSeen < target) {
      probe.setDate(probe.getDate() + 1);
      if (isBusinessDay(probe, holidays)) businessSeen++;
    }
    return probe;
  };
  const end = parseDateString(endDateStr);

  // ------------------------------------------------------------------
  // Sequência com ritmo ~2:1 BALANCEADO (distribuição uniforme de Bresenham):
  //   São 15 AV e 12 PB (27 posições). Em vez de gastar todos os PB no
  //   começo (deixando uma cauda só de AV) ou deixar os PB para o fim,
  //   calculamos matematicamente em quais posições deve cair cada PB:
  //       posição p recebe PB quando floor(p * nPB / total) avança em
  //       relação a floor((p-1) * nPB / total).
  //   Com 27/12 isso gera o padrão AV, AV, PB, AV, AV, PB … distribuído
  //   por TODO o plano — inclusive nas últimas semanas, onde alternam
  //   AV e PB até acabar. O usuário pode inverter as direções das filas.
  // ------------------------------------------------------------------

  const orient = (list: string[], order: SeriesOrder): string[] =>
    order === "desc" ? [...list].reverse() : list;

  const avList = orient(SERIES_AV, avOrder);
  const pbList = orient(SERIES_PB, pbOrder);

  const total = avList.length + pbList.length;
  const nPb = pbList.length;

  // Mapa posição → categoria usando distribuição uniforme (Bresenham).
  // Garante que os 12 slots de PB fiquem espaçados igualmente ao longo
  // das 27 semanas, sem concentrar nem no início nem no fim.
  const slotIsPb: boolean[] = [];
  for (let p = 1; p <= total; p++) {
    const before = Math.floor(((p - 1) * nPb) / total);
    const now = Math.floor((p * nPb) / total);
    slotIsPb.push(now > before);
  }

  // Monta a sequência respeitando o mapa de slots. Se um item de PB cair
  // "colado" no par da mesma série (MIN_GAP), trocamos com o próximo PB
  // livre da fila; se não houver, trocamos de AV — mantendo o ritmo.
  const MIN_GAP = 3; // distância mínima de posições entre o par AV/PB da mesma série
  const sequence: Array<{ categoryId: string; seriesId: string }> = [];
  const lastAvPos = new Map<string, number>(); // última posição de AV por série
  const lastPbPos = new Map<string, number>(); // última posição de PB por série
  const avQueue = avList.map((s) => ({ categoryId: "ATIVIDADES_VARIADAS", seriesId: s }));
  const pbQueue = pbList.map((s) => ({ categoryId: "PROGRAMA_BILINGUE", seriesId: s }));

  const isTooClose = (seriesId: string, pos: number, map: Map<string, number>): boolean => {
    const lp = map.get(seriesId);
    return lp !== undefined && pos - lp < MIN_GAP;
  };

  let ai = 0;
  let pi = 0;
  for (let p = 1; p <= total; p++) {
    const wantPb = slotIsPb[p - 1];
    if (wantPb) {
      // Slot de PB: pega o primeiro da fila (ordem escolhida) que respeite a
      // distância mínima do AV já emitido para a mesma série. Remove apenas
      // esse item — sem rotacionar a fila, preservando a direção.
      let k = pi;
      while (k < pbQueue.length && isTooClose(pbQueue[k].seriesId, p, lastAvPos)) k++;
      if (k < pbQueue.length) {
        const item = pbQueue.splice(k, 1)[0];
        sequence.push(item);
        lastPbPos.set(item.seriesId, p);
        continue;
      }
      // Todos os PB restantes estão colados no par: usa uma AV neste slot e
      // deixa o PB para o próximo — o ritmo ~2:1 continua balanceado.
    }
    if (ai < avQueue.length) {
      // Mesmo princípio para AV: primeiro da fila que não encosta em PB já
      // emitido da mesma série.
      let k = ai;
      while (k < avQueue.length && isTooClose(avQueue[k].seriesId, p, lastPbPos)) k++;
      if (k >= avQueue.length) k = ai; // força a ordem se todas colidirem
      const item = avQueue.splice(k, 1)[0];
      sequence.push(item);
      lastAvPos.set(item.seriesId, p);
      continue;
    }
    // AV esgotada (não acontece com 15 AV × 12 PB, protege configs futuras)
    if (pi < pbQueue.length) {
      const item = pbQueue.splice(pi, 1)[0];
      sequence.push(item);
      lastPbPos.set(item.seriesId, p);
    }
  }

  const warnings: string[] = [];
  let skipped = 0;
  let weekBase = new Date(start);
  const publications: Omit<Publication, "id">[] = [];

  for (const item of sequence) {
    // Data da semana corrente ajustada para o dia útil alvo (Seg→Sex rotativo)
    let dateCursor = alignToNthBusinessDay(weekBase);
    // Se o dia alvo caiu em feriado e empurrou para o fim de semana,
    // avança até o próximo dia útil.
    let guard = 0;
    while (!isBusinessDay(dateCursor, holidays) && guard < 220) {
      skipped++;
      dateCursor = new Date(dateCursor);
      dateCursor.setDate(dateCursor.getDate() + 1);
      guard++;
    }

    const dateStr = formatDateToISO(dateCursor);
    if (parseDateString(dateStr) > end) {
      warnings.push(
        `Período encerrado em ${endDateStr}: ${item.seriesId} (${item.categoryId}) não pôde ser agendada.`
      );
      continue;
    }

    const productionDays = getProductionDays(item.categoryId, item.seriesId);
    publications.push({
      title: "",
      description: "Publicação obrigatória gerada automaticamente pelo plano anual.",
      categoryId: item.categoryId,
      seriesId: item.seriesId,
      status: "PLANEJAMENTO" as PublicationStatus,
      priority: "MEDIA" as Priority,
      publicationDate: dateStr,
      plannedDate: calculatePlannedDate(dateStr, productionDays, holidays),
      productionDays,
      tags: ["obrigatoria", "plano-anual"],
    });

    // Próxima publicação na semana seguinte (1 por semana), em outro dia da
    // semana — evita que tudo fique agendado nas segundas-feiras.
    advanceWeekday();
    weekBase = new Date(weekBase);
    weekBase.setDate(weekBase.getDate() + 7);
  }

  return { publications, skippedWeekendsAndHolidays: skipped, warnings };
}

/** IDs estáveis (determinísticos) para as publicações geradas */
export function mandatoryStableId(year: number, categoryId: string, seriesId: string): string {
  return `gen-${year}-${categoryId}-${seriesId}`;
}

/**
 * Remove publicações antigas substituídas pela geração (título vazio + tag
 * "obrigatoria" + categoria obrigatória + ano alvo) — apenas quando o usuário
 * escolhe substituir as existentes.
 */
export function findOutdatedGenerated(
  existing: Publication[],
  year: number
): Publication[] {
  return existing.filter(
    (p) =>
      !p.isDeleted &&
      p.title === "" &&
      p.tags?.includes("obrigatoria") &&
      (p.categoryId === "ATIVIDADES_VARIADAS" || p.categoryId === "PROGRAMA_BILINGUE") &&
      p.publicationDate.startsWith(String(year))
  );
}
