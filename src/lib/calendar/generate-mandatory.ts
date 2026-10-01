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
 *  - Intercalação por FASES (espelhando o plano de 2026): primeiro as fases
 *    iniciais (Maternal → Pré) das duas categorias, depois as séries inicias
 *    (1º–5º Ano), depois as intermediárias (6º–9º Ano) e por último o Ensino
 *    Médio. Assim a publicação do Maternal de Atividades Variadas NUNCA vem
 *    logo em seguida da publicação do Maternal do Programa Bilíngue — entre
 *    elas sempre haverá publicações de outras séries.
 *  - Nunca em finais de semana nem feriados (usa os feriados cadastrados)
 *  - Sem título e com status "PLANEJAMENTO"
 */

export interface GenerationOptions {
  year: number;
  /** Data inicial do período (YYYY-MM-DD). Default: 10/fevereiro do ano letivo */
  startDate?: string;
  /** Data final do período (YYYY-MM-DD). Default: 30/setembro */
  endDate?: string;
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
  const startDateStr = options.startDate ?? `${year}-02-10`;
  const endDateStr = options.endDate ?? `${year}-09-30`;

  const start = parseDateString(startDateStr);
  // Começa sempre na segunda-feira da semana da data inicial
  if (start.getDay() !== 1) {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  }
  const end = parseDateString(endDateStr);

  // ------------------------------------------------------------------
  // Sequência espelhada no plano real de 2026 (datas previstas):
  //
  //   AV: Maternal(20/fev) Jardim(25/mar) Pré(08/mai) 1ºAno(16/jun) …
  //   PB: 5ºAno(24/fev) 9ºAno(04/mai) Maternal(28/mai) … Jardim(17/ago)
  //
  // Regra central observada no modelo: entre a publicação de uma série em
  // Atividades Variadas e a MESMA série em Programa Bilíngue sempre existem
  // várias outras publicações — nunca uma em seguida da outra.
  //
  // Implementação: bloco AV (15 séries, ordem didática Maternal→Médio) e
  // bloco PB (12 séries), entrelaçados com distância mínima (PB_GAP semanas)
  // entre a mesma série nas duas categorias. O primeiro item de PB entra só
  // após as primeiras infantis de AV (como no 2026, onde o 1º PB foi um 5º
  // Ano logo na 1ª semana — aqui mantemos a folga garantida por série).
  // ------------------------------------------------------------------

  // Ordem das séries dentro de cada categoria, agrupada por faixas:
  // infantil (3), anos iniciais (5), anos finais (4), ensino médio (3).
  const PHASES: Array<{ av: string[]; pb: string[] }> = [
    { av: ["MATERNAL", "JARDIM", "PRE"],                 pb: ["MATERNAL", "JARDIM", "PRE"] },
    { av: ["ANO_1", "ANO_2", "ANO_3", "ANO_4", "ANO_5"], pb: ["ANO_1", "ANO_2", "ANO_3", "ANO_4", "ANO_5"] },
    { av: ["ANO_6", "ANO_7", "ANO_8", "ANO_9"],          pb: ["ANO_6", "ANO_7", "ANO_8", "ANO_9"] },
    { av: ["MEDIO_1", "MEDIO_2", "MEDIO_3"],             pb: [] as string[] },
  ];

  // Estratégia de intercalação (igual ao 2026): percorre as fases em ordem,
  // emitindo primeiro toda a fase de AV e, logo atrás dela (com atraso de
  // uma janela inteira da fase), a mesma fase de PB. Como cada fase tem
  // tamanho >= 3, a série X de AV nunca fica adjacente à série X de PB.
  const avItems = PHASES.flatMap((p) => p.av.map((s) => ({ categoryId: "ATIVIDADES_VARIADAS", seriesId: s })));
  const pbItems = PHASES.flatMap((p) => p.pb.map((s) => ({ categoryId: "PROGRAMA_BILINGUE", seriesId: s })));

  // Mescla determinística: para cada item de AV, insere itens de PB apenas
  // quando já passaram pelo menos PB_GAP publicações desde o item AV da
  // MESMA série — garantindo distância mínima entre a mesma série nas duas
  // categorias (no plano 2026 essa distância é de 3 a 10 semanas).
  const PB_GAP = 4;
  const avIndexOfSeries = new Map<string, number>();
  avItems.forEach((it, idx) => avIndexOfSeries.set(it.seriesId, idx));
  const pbBySeriesOrder = pbItems; // já na ordem Maternal→9º Ano

  const sequence: Array<{ categoryId: string; seriesId: string }> = [];
  let pbCursor = 0;
  for (let i = 0; i < avItems.length; i++) {
    sequence.push(avItems[i]);
    // Solta itens de PB cujo "par de AV da mesma série" já está a PB_GAP
    // ou mais posições para trás.
    while (pbCursor < pbBySeriesOrder.length) {
      const candidate = pbBySeriesOrder[pbCursor];
      const avIdx = avIndexOfSeries.get(candidate.seriesId);
      // Séries sem par em AV (não existem aqui) entram livremente.
      if (avIdx === undefined || i - avIdx >= PB_GAP) {
        sequence.push(candidate);
        pbCursor++;
      } else {
        break;
      }
    }
  }
  // PBs restantes (séries do fundamental final que só liberam no fim)
  while (pbCursor < pbBySeriesOrder.length) {
    sequence.push(pbBySeriesOrder[pbCursor]);
    pbCursor++;
  }

  const warnings: string[] = [];
  let skipped = 0;
  let dateCursor = new Date(start);
  const publications: Omit<Publication, "id">[] = [];

  for (const item of sequence) {
    // Avança o cursor até encontrar um dia útil (segunda a sexta, sem feriado)
    let guard = 0;
    while (!isBusinessDay(dateCursor, holidays) && guard < 220) {
      skipped++;
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

    // Próxima publicação exatamente 1 semana depois (1 publicação por semana)
    dateCursor.setDate(dateCursor.getDate() + 7);
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
