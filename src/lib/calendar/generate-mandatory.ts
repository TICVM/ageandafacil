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
 * Recupera o histórico de exclusões de uma publicação. Quando ela é apagada,
 * alguns fluxos registram aqui os dados originais (categoria, série, datas),
 * permitindo restaurá-la exatamente como estava no Controle de Publicações.
 */
const DELETED_SNAPSHOT_KEY = "schoollens_deleted_publication_snapshots_v1";

export type DeletedSnapshotMap = Record<string, Omit<Publication, "id"> & { id?: string }>;

export function getDeletedSnapshots(): DeletedSnapshotMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(DELETED_SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as DeletedSnapshotMap) : {};
  } catch {
    return {};
  }
}

/** Salva (ou substitui) o snapshot de uma publicação excluída. */
export function saveDeletedSnapshot(pub: Publication): void {
  if (typeof window === "undefined") return;
  try {
    const map = getDeletedSnapshots();
    map[pub.id] = { ...pub };
    localStorage.setItem(DELETED_SNAPSHOT_KEY, JSON.stringify(map));
  } catch {}
}

/** Remove o snapshot após a restauração bem-sucedida. */
export function clearDeletedSnapshot(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const map = getDeletedSnapshots();
    if (!(id in map)) return;
    delete map[id];
    localStorage.setItem(DELETED_SNAPSHOT_KEY, JSON.stringify(map));
  } catch {}
}

/** Série pertence à categoria? (PB vai do Maternal ao 9º Ano; AV até o 3º Médio) */
function seriesInCategory(categoryId: string, seriesId: string): boolean {
  if (categoryId === PB_CATEGORY_ID_CONST) return SERIES_PB.includes(seriesId);
  return SERIES_AV.includes(seriesId);
}

/**
 * Constrói a publicação obrigatória que faltava para uma dada série/categoria/ano.
 *
 * Estratégia de data: percorre-se o plano completo do ano e retiram-se as
 * publicações obrigatórias ainda vivas; a vaga da publicação excluída fica
 * livre e as demais ocupam as semanas seguintes — assim a restaurada recebe a
 * data que seria dela originalmente, sem colidir com as que continuam na tabela.
 * Se não houver nenhuma data livre, usa-se a data sugerida pelo usuário.
 */
export function buildMissingMandatoryPublication(
  params: {
    year: number;
    categoryId: string;
    seriesId: string;
    holidays: Holiday[];
    existing: Publication[];
    /** Data escolhida pelo usuário (fallback / sugestão). */
    date?: string;
  }
): Omit<Publication, "id"> {
  const { year, categoryId, seriesId, holidays, existing, date } = params;

  const isMandatory = (p: Publication) =>
    !p.isDeleted &&
    (p.tags?.includes("obrigatoria") || p.tags?.includes("plano-anual")) &&
    p.publicationDate.startsWith(String(year));

  // Reconstrói o plano do ano para descobrir qual semana pertencia à série.
  let candidateDate = "";
  try {
    const fullPlan = generateMandatoryPublications({ year }, holidays).publications;
    const taken = new Set(
      existing.filter(isMandatory).map((p) => p.publicationDate)
    );
    const missingOfSameKind = fullPlan.filter(
      (g) => g.categoryId === categoryId && g.seriesId === seriesId
    );
    const freeSlot = [...missingOfSameKind, ...fullPlan].find(
      (g) => !taken.has(g.publicationDate)
    );
    if (freeSlot) candidateDate = freeSlot.publicationDate;
  } catch {
    /* geração indisponível — usa a data sugerida */
  }

  if (!candidateDate) candidateDate = date ?? `${year}-06-01`;

  // Ajusta para dia útil (nunca fim de semana/feriado) e evita duplicar data.
  const takenDates = new Set(existing.filter(isMandatory).map((p) => p.publicationDate));
  let cursor = parseDateString(candidateDate);
  const endOfYear = parseDateString(`${year}-12-31`);
  let guard = 0;
  while (
    (!isBusinessDay(cursor, holidays) || takenDates.has(formatDateToISO(cursor))) &&
    cursor <= endOfYear &&
    guard < 300
  ) {
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 1);
    guard++;
  }
  const publicationDate = formatDateToISO(cursor);

  const productionDays = getProductionDays(categoryId, seriesId);

  return {
    title: "",
    description:
      "Publicação obrigatória restaurada no Controle de Publicações (plano anual).",
    categoryId,
    seriesId,
    status: "PLANEJAMENTO" as PublicationStatus,
    priority: "MEDIA" as Priority,
    publicationDate,
    plannedDate: calculatePlannedDate(publicationDate, productionDays, holidays),
    productionDays,
    tags: ["obrigatoria", "plano-anual"],
  };
}

const PB_CATEGORY_ID_CONST = "PROGRAMA_BILINGUE";

/**
 * Lista as publicações obrigatórias do plano anual que estão FALTANDO em um
 * ano — isto é, cada combinação série × categoria (AV: 15 séries, PB: 12) que
 * não possui nenhuma publicação ativa. É o caso do 5º Ano do Programa Bilíngue
 * que sumiu da tabela após uma alteração/exclusão.
 */
export function findMissingMandatorySeries(
  publications: Publication[],
  year: number
): Array<{ categoryId: string; seriesId: string }> {
  const present = new Set<string>();
  for (const p of publications) {
    if (
      !p.isDeleted &&
      (p.tags?.includes("obrigatoria") || p.tags?.includes("plano-anual")) &&
      p.categoryId &&
      p.seriesId &&
      p.publicationDate?.startsWith(String(year))
    ) {
      present.add(`${p.categoryId}|${p.seriesId}`);
    }
  }
  const missing: Array<{ categoryId: string; seriesId: string }> = [];
  for (const s of SERIES_AV) {
    if (!present.has(`ATIVIDADES_VARIADAS|${s}`)) {
      missing.push({ categoryId: "ATIVIDADES_VARIADAS", seriesId: s });
    }
  }
  for (const s of SERIES_PB) {
    if (!present.has(`${PB_CATEGORY_ID_CONST}|${s}`)) {
      missing.push({ categoryId: PB_CATEGORY_ID_CONST, seriesId: s });
    }
  }
  return missing;
}

/**
 * Restaura publicações obrigatórias faltantes do plano anual.
 *
 * Para cada série/categoria informada:
 *  1. se houver snapshot salvo no momento da exclusão, recria com os dados
 *     originais (datas, título e status que a publicação tinha);
 *  2. caso contrário, reconstrói a publicação a partir do algoritmo do plano
 *     anual, respeitando as datas das publicações que ainda existem;
 *  3. se a publicação apenas saiu do ano selecionado (data movida para outro
 *     ano), corrige a data de volta para o ano do plano.
 *
 * Retorna a lista de publicações prontas para serem criadas/atualizadas pela
 * UI (`onRestore` decide como persistir).
 */
export function restoreMissingMandatoryPublications(params: {
  year: number;
  targets: Array<{ categoryId: string; seriesId: string }>;
  holidays: Holiday[];
  existing: Publication[];
}): { toCreate: Omit<Publication, "id">[]; toUpdate: Array<{ id: string; updates: Partial<Publication> }> } {
  const { year, targets, holidays, existing } = params;
  const toCreate: Omit<Publication, "id">[] = [];
  const toUpdate: Array<{ id: string; updates: Partial<Publication> }> = [];
  const usedDates = new Set(
    existing
      .filter(
        (p) =>
          !p.isDeleted &&
          (p.tags?.includes("obrigatoria") || p.tags?.includes("plano-anual")) &&
          p.publicationDate?.startsWith(String(year))
      )
      .map((p) => p.publicationDate)
  );

  const snapshots = getDeletedSnapshots();

  const publicationsWithPending = (): Publication[] => [
    ...existing,
    ...toCreate.map((c, i) => ({ ...c, id: `pending-${i}` }) as Publication),
  ];

  for (const target of targets) {
    if (!seriesInCategory(target.categoryId, target.seriesId)) continue;

    // 1) Snapshot da exclusão → restaura com os dados originais.
    const snap = Object.values(snapshots).find(
      (s) =>
        s?.categoryId === target.categoryId &&
        s?.seriesId === target.seriesId &&
        s?.publicationDate?.startsWith(String(year))
    );
    if (snap) {
      const { id: _id, history: _h, createdAt: _c, updatedAt: _u, isDeleted: _d, ...rest } =
        snap as Publication;
      void _id; void _h; void _c; void _u; void _d;
      let date = rest.publicationDate;
      if (usedDates.has(date) || !isBusinessDay(parseDateString(date), holidays)) {
        date = buildMissingMandatoryPublication({
          year,
          categoryId: target.categoryId,
          seriesId: target.seriesId,
          holidays,
          existing: publicationsWithPending(),
          date: rest.publicationDate,
        }).publicationDate;
      }
      usedDates.add(date);
      toCreate.push({
        ...rest,
        publicationDate: date,
        plannedDate: calculatePlannedDate(
          date,
          rest.productionDays ?? getProductionDays(target.categoryId, target.seriesId),
          holidays
        ),
        tags: [
          ...new Set([
            ...(rest.tags ?? []).filter((t) => t !== "obrigatoria" && t !== "plano-anual"),
            "obrigatoria",
            "plano-anual",
          ]),
        ],
      });
      if (snap.id) clearDeletedSnapshot(snap.id);
      continue;
    }

    // 2) Existe em outro ano? (a data foi alterada para fora do ano do plano e
    //    por isso ela "sumiu" da tabela) → corrige a data de volta para o ano.
    const moved = existing.find(
      (p) =>
        !p.isDeleted &&
        p.categoryId === target.categoryId &&
        p.seriesId === target.seriesId &&
        (p.tags?.includes("obrigatoria") || p.tags?.includes("plano-anual")) &&
        !p.publicationDate.startsWith(String(year))
    );
    if (moved) {
      const rebuilt = buildMissingMandatoryPublication({
        year,
        categoryId: target.categoryId,
        seriesId: target.seriesId,
        holidays,
        existing: publicationsWithPending(),
      });
      usedDates.add(rebuilt.publicationDate);
      toUpdate.push({
        id: moved.id,
        updates: {
          publicationDate: rebuilt.publicationDate,
          plannedDate: rebuilt.plannedDate,
          tags: [
            ...new Set([
              ...(moved.tags ?? []).filter(
                (t) => t !== "obrigatoria" && t !== "plano-anual"
              ),
              "obrigatoria",
              "plano-anual",
            ]),
          ],
        },
      });
      continue;
    }

    // 3) Não há registro — reconstrói pelo algoritmo do plano anual.
    const rebuilt = buildMissingMandatoryPublication({
      year,
      categoryId: target.categoryId,
      seriesId: target.seriesId,
      holidays,
      existing: publicationsWithPending(),
    });
    usedDates.add(rebuilt.publicationDate);
    toCreate.push(rebuilt);
  }

  return { toCreate, toUpdate };
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
