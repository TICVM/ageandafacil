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
 *  - Ritmo de intercalação fixo 2:1 — a cada 2 publicações de Atividades
 *    Variadas vem 1 do Programa Bilíngue. Ex.:
 *      Maternal  → Atividades Variadas  (08/02)
 *      Jardim    → Atividades Variadas  (16/02)
 *      9º Ano    → Programa Bilíngue    (24/02)
 *      Pré       → Atividades Variadas  (02/03)
 *      1º Ano    → Atividades Variadas  (09/03)
 *      8º Ano    → Programa Bilíngue    (16/03) …
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

/** Ritmo fixo de intercalação: a cada 2 AV, 1 PB */
const AV_PER_PB = 2;

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
  // Sequência no ritmo 2:1 pedido pelo usuário:
  //   pos 1: AV[0]  (Maternal)      pos 2: AV[1]  (Jardim)
  //   pos 3: PB[0]  (9º Ano)        pos 4: AV[2]  (Pré)
  //   pos 5: AV[3]  (1º Ano)        pos 6: PB[1]  (8º Ano)  …
  //
  // AV consome a fila Maternal → 3º Médio; PB consome a fila oposta
  // (9º Ano → Maternal). Direções podem ser invertidas pelo usuário.
  // ------------------------------------------------------------------

  const orient = (list: string[], order: SeriesOrder): string[] =>
    order === "desc" ? [...list].reverse() : list;

  const avQueue = orient(SERIES_AV, avOrder).map((s) => ({
    categoryId: "ATIVIDADES_VARIADAS",
    seriesId: s,
  }));
  const pbQueue = orient(SERIES_PB, pbOrder).map((s) => ({
    categoryId: "PROGRAMA_BILINGUE",
    seriesId: s,
  }));

  // Intercalação no ritmo 2:1 — a cada 2 publicações de Atividades Variadas
  // vem 1 do Programa Bilíngue (ex.: Maternal-AV, Jardim-AV, 9ºAno-PB,
  // Pré-AV, 1ºAno-AV, 8ºAno-PB …). AV percorre as séries em uma direção e PB
  // na oposta; o usuário pode inverter. Como as filas andam em sentidos
  // contrários, uma série só "encosta" no próprio par perto do meio do plano.
  // Nesse caso procuramos adiante na fila de PB (mantendo a direção escolhida)
  // um item cuja série não apareceu como AV nos últimos MIN_GAP slots; se
  // todos estiverem colados, adiamos o PB e emitimos mais uma AV.
  const MIN_GAP = 3; // distância mínima de posições entre o par AV/PB da mesma série
  const sequence: Array<{ categoryId: string; seriesId: string }> = [];
  const lastAvPos = new Map<string, number>(); // última posição de AV por série
  const pendingPb = [...pbQueue]; // fila de PB na ordem de emissão escolhida
  let ai = 0; // ponteiro da fila AV
  let avRun = 0; // AVs emitidas desde o último PB

  const isBlocked = (seriesId: string, pos: number): boolean => {
    const lp = lastAvPos.get(seriesId);
    return lp !== undefined && pos - lp < MIN_GAP;
  };

  while (ai < avQueue.length || pendingPb.length > 0) {
    if (pendingPb.length === 0) {
      // cauda de AV (15 AV × 12 PB → sobram 3 AV no fim)
      sequence.push(avQueue[ai]);
      lastAvPos.set(avQueue[ai].seriesId, sequence.length);
      ai++;
      avRun++;
      continue;
    }
    if (ai >= avQueue.length) {
      // cauda de PB: solta em ordem
      sequence.push(pendingPb.shift()!);
      avRun = 0;
      continue;
    }
    if (avRun >= AV_PER_PB) {
      // Slot de PB: pega o primeiro da fila que respeite a distância mínima
      const nextPos = sequence.length + 1;
      let k = -1;
      for (let j = 0; j < pendingPb.length; j++) {
        if (!isBlocked(pendingPb[j].seriesId, nextPos)) {
          k = j;
          break;
        }
      }
      if (k >= 0) {
        const item = pendingPb.splice(k, 1)[0];
        if (k > 0) pendingPb.unshift(item); // volta p/ frente: direção preservada quando destravar
        sequence.push(item);
        avRun = 0;
        continue;
      }
      // Todos os PB pendentes estão colados no par: emite mais uma AV antes.
      sequence.push(avQueue[ai]);
      lastAvPos.set(avQueue[ai].seriesId, sequence.length);
      ai++;
      avRun++;
      continue;
    }
    sequence.push(avQueue[ai]);
    lastAvPos.set(avQueue[ai].seriesId, sequence.length);
    ai++;
    avRun++;
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
