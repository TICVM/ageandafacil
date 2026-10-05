"use client";

/**
 * Importação / Exportação em Excel do "Controle de Publicações".
 *
 * Formato do arquivo (uma planilha por categoria):
 *   - "Atividades Variadas"  → categoryId ATIVIDADES_VARIADAS
 *   - "Programa Bilíngue"    → categoryId PROGRAMA_BILINGUE
 * Colunas: Série | Data Prevista | Data da Publicação | Título | Status
 *
 * A exportação usa exatamente os mesmos rótulos exibidos na tabela, de modo
 * que o arquivo pode ser editado no Excel e reimportado sem divergências:
 *   - Datas aceitas na importação: DD/MM/AAAA, AAAA-MM-DD ou célula de data.
 *   - Status aceito: rótulo em português ("Produção de Conteúdo") OU código
 *     ("PRODUCAO_CONTEUDO"), ignorando maiúsculas/acentos.
 *   - Série aceita: nome ("1º Ano") OU id ("ANO_1").
 */

import * as XLSX from "xlsx";
import {
  Category,
  Priority,
  Publication,
  PublicationStatus,
  Series,
} from "@/lib/calendar/types";
import { normalizePublicationStatus } from "@/lib/scheduler/status-mapping";

export const AV_CATEGORY_ID = "ATIVIDADES_VARIADAS";
export const PB_CATEGORY_ID = "PROGRAMA_BILINGUE";

const HEADERS = [
  "Série",
  "Data Prevista",
  "Data da Publicação",
  "Título da Publicação",
  "Status",
] as const;

/** Remove acentos e normaliza espaços para comparação de rótulos. */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatDateBR(iso?: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** Converte valor de célula (Date, serial do Excel, texto) em YYYY-MM-DD. */
function cellToISO(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !isNaN(value.getTime())) {
    // Serial do Excel convertido pela SheetJS pode vir com offset de UTC.
    return toISO(new Date(value.getTime() - value.getTimezoneOffset() * 60000));
  }
  if (typeof value === "number" && isFinite(value)) {
    const dt = XLSX.SSF.parse_date_code(value);
    if (dt) {
      return `${String(dt.y).padStart(4, "0")}-${pad2(dt.m)}-${pad2(dt.d)}`;
    }
    return null;
  }
  const raw = String(value).trim();
  // ISO: AAAA-MM-DD
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  // BR: DD/MM/AAAA ou DD-MM-AAAA
  const brMatch = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (brMatch) {
    return `${brMatch[3]}-${pad2(Number(brMatch[2]))}-${pad2(Number(brMatch[1]))}`;
  }
  return null;
}

interface StatusMeta {
  value: PublicationStatus;
  label: string;
}

/** Rótulos/códigos de status válidos no sistema (mesmos usados na UI). */
const STATUS_ALIASES: Record<string, PublicationStatus> = {
  planejamento: "PLANEJAMENTO",
  briefing: "BRIEFING",
  producao_de_conteudo: "PRODUCAO_CONTEUDO",
  producao_conteudo: "PRODUCAO_CONTEUDO",
  "producao de conteudo": "PRODUCAO_CONTEUDO",
  design_e_arte: "DESIGN_ARTE",
  design_arte: "DESIGN_ARTE",
  "design & arte": "DESIGN_ARTE",
  "design arte": "DESIGN_ARTE",
  revisao_aprovacao: "REVISAO_APROVACAO",
  "revisao / aprovacao": "REVISAO_APROVACAO",
  "revisao aprovacao": "REVISAO_APROVACAO",
  aprovado_para_publicar: "APROVADO_PARA_PUBLICAR",
  "aprovado para publicar": "APROVADO_PARA_PUBLICAR",
  agendado: "AGENDADO",
  publicado: "PUBLICADO",
  atrasado: "ATRASADO",
  cancelado: "CANCELADO",
  pausado: "PAUSADO",
  reprogramado: "REPROGRAMADO",
};

function parseStatus(raw: unknown): PublicationStatus | null {
  if (raw == null || String(raw).trim() === "") return null;
  const key = norm(String(raw));
  if (STATUS_ALIASES[key]) return STATUS_ALIASES[key];
  // Código direto em MAIÚSCULAS (ex.: PRODUCAO_CONTEUDO vindo de outro export)
  const upper = String(raw).trim().toUpperCase().replace(/\s+/g, "_");
  const byCode = Object.entries(STATUS_ALIASES).find(
    ([, v]) => v === upper
  );
  if (byCode) return byCode[1];
  return normalizePublicationStatus(upper as PublicationStatus);
}

/** Resolve série pelo nome ("5º Ano") ou id ("ANO_5"); cria entrada temporária se necessário. */
function resolveSeries(
  raw: unknown,
  seriesList: Series[]
): { id: string; name: string } | null {
  if (raw == null || String(raw).trim() === "") return null;
  const key = norm(String(raw));
  const found = seriesList.find(
    (s) => norm(s.name) === key || norm(s.id) === key
  );
  if (found) return { id: found.id, name: found.name };
  // Desconhecida: preserva o texto como id "amigável" para não perder dados.
  const clean = String(raw).trim();
  return { id: clean.toUpperCase().replace(/\s+/g, "_"), name: clean };
}

// ---------------------------------------------------------------------------
// EXPORTAÇÃO
// ---------------------------------------------------------------------------

export interface ExportOptions {
  publications: Publication[];
  seriesList: Series[];
  statuses: StatusMeta[];
  year: number;
}

function isMandatory(p: Publication): boolean {
  const tags = p.tags ?? [];
  return tags.includes("obrigatoria") || tags.includes("plano-anual");
}

function sheetRows(
  pubs: Publication[],
  seriesNameById: Map<string, string>,
  statusLabelByKey: Map<string, string>
): (string | number)[][] {
  const rows: (string | number)[][] = [HEADERS.slice()];
  pubs.forEach((p) => {
    const key = normalizePublicationStatus(p.status) ?? p.status;
    rows.push([
      seriesNameById.get(p.seriesId ?? "") ?? p.seriesId ?? "",
      formatDateBR(p.plannedDate),
      formatDateBR(p.publicationDate),
      p.title ?? "",
      statusLabelByKey.get(key) ?? key,
    ]);
  });
  return rows;
}

/**
 * Gera e baixa um arquivo .xlsx com duas abas (Atividades Variadas e Programa
 * Bilíngue) contendo as publicações obrigatórias do ano informado.
 */
export function exportControlToExcel({
  publications,
  seriesList,
  statuses,
  year,
}: ExportOptions): void {
  const seriesNameById = new Map(seriesList.map((s) => [s.id, s.name]));
  const statusLabelByKey = new Map(statuses.map((s) => [s.value, s.label]));

  const mandatoryOfYear = publications.filter(
    (p) =>
      !p.isDeleted &&
      isMandatory(p) &&
      p.publicationDate.startsWith(String(year))
  );

  const av = mandatoryOfYear
    .filter((p) => p.categoryId === AV_CATEGORY_ID)
    .sort((a, b) => a.publicationDate.localeCompare(b.publicationDate));
  const pb = mandatoryOfYear
    .filter((p) => p.categoryId === PB_CATEGORY_ID)
    .sort((a, b) => a.publicationDate.localeCompare(b.publicationDate));

  const wb = XLSX.utils.book_new();
  const wsAv = XLSX.utils.aoa_to_sheet(sheetRows(av, seriesNameById, statusLabelByKey));
  const wsPb = XLSX.utils.aoa_to_sheet(sheetRows(pb, seriesNameById, statusLabelByKey));
  const colWidths = [{ wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 42 }, { wch: 24 }];
  wsAv["!cols"] = colWidths;
  wsPb["!cols"] = colWidths;
  XLSX.utils.book_append_sheet(wb, wsAv, "Atividades Variadas");
  XLSX.utils.book_append_sheet(wb, wsPb, "Programa Bilíngue");

  XLSX.writeFile(wb, `controle-publicacoes-${year}.xlsx`);
}

// ---------------------------------------------------------------------------
// IMPORTAÇÃO
// ---------------------------------------------------------------------------

export interface ImportedRow {
  categoryId: string;
  seriesId: string;
  seriesName: string;
  plannedDate: string | null;
  publicationDate: string | null;
  title: string;
  status: PublicationStatus | null;
  /** true quando a linha corresponde a uma publicação existente (atualizar). */
  matchedExisting: boolean;
  existingId?: string;
}

export interface ImportResult {
  rows: ImportedRow[];
  errors: string[];
}

export interface ImportOptions {
  file: File;
  publications: Publication[];
  seriesList: Series[];
  categories: Category[];
}

function categoryFromSheetName(name: string): string | null {
  const key = norm(name);
  if (key.includes("bilingue") || key.includes("bilingue")) return PB_CATEGORY_ID;
  if (key.includes("atividade") || key.includes("variada")) return AV_CATEGORY_ID;
  return null;
}

/**
 * Lê o arquivo .xlsx e produz as linhas já resolvidas (série, datas, status),
 * indicando se cada linha atualiza uma publicação existente ou cria nova.
 * Nenhuma gravação é feita aqui — quem persiste é a UI após confirmação.
 */
export async function parseControlWorkbook({
  file,
  publications,
  seriesList,
}: ImportOptions): Promise<ImportResult> {
  const errors: string[] = [];
  const rows: ImportedRow[] = [];

  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });

  if (wb.SheetNames.length === 0) {
    return { rows, errors: ["O arquivo não contém nenhuma planilha."] };
  }

  // Índice das publicações obrigatórias existentes: categoria|série|data publicação
  const mandatoryIndex = new Map<string, Publication>();
  publications
    .filter((p) => !p.isDeleted && isMandatory(p))
    .forEach((p) => {
      const k = `${p.categoryId}|${p.seriesId ?? ""}|${p.publicationDate}`;
      mandatoryIndex.set(k, p);
    });

  let parsedAny = false;

  wb.SheetNames.forEach((sheetName) => {
    const categoryId = categoryFromSheetName(sheetName);
    if (!categoryId) {
      errors.push(
        `Aba "${sheetName}" ignorada (esperado "Atividades Variadas" ou "Programa Bilíngue").`
      );
      return;
    }
    const ws = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(ws, {
      header: 1,
      blankrows: false,
      defval: null,
    });

    // Localiza a linha de cabeçalho (primeira linha contendo "Série")
    let headerIdx = -1;
    for (let i = 0; i < Math.min(aoa.length, 10); i++) {
      const line = (aoa[i] ?? []).map((c) => norm(String(c ?? "")));
      if (line.includes("série") || line.includes("serie")) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) {
      errors.push(`Aba "${sheetName}": cabeçalho não encontrado (coluna "Série").`);
      return;
    }

    const header = (aoa[headerIdx] ?? []).map((c) => norm(String(c ?? "")));
    const serieIdx = Math.max(header.indexOf("série"), header.indexOf("serie"));
    const previstaIdx = header.findIndex((h) => h.includes("prevista"));
    const publicacaoIdx = header.findIndex(
      (h) => h.includes("publicacao") && h !== header[previstaIdx]
    );
    const tituloIdx = header.findIndex((h) => h.includes("titulo"));
    const statusIdx = header.findIndex((h) => h.includes("status"));
    const col: {
      serie: number;
      prevista: number;
      publicacao: number;
      titulo: number;
      status: number;
    } = {
      serie: serieIdx,
      prevista: previstaIdx,
      publicacao: publicacaoIdx,
      titulo: tituloIdx,
      status: statusIdx,
    };

    aoa.slice(headerIdx + 1).forEach((line, idx) => {
      const rowNum = headerIdx + idx + 2;
      const serieRaw = col.serie >= 0 ? line[col.serie] : null;
      if (serieRaw == null || String(serieRaw).trim() === "") return; // linha vazia

      const series = resolveSeries(serieRaw, seriesList);
      if (!series) {
        errors.push(`${sheetName} linha ${rowNum}: série vazia.`);
        return;
      }
      const pubDate = col.publicacao >= 0 ? cellToISO(line[col.publicacao]) : null;
      const planDate = col.prevista >= 0 ? cellToISO(line[col.prevista]) : null;
      if (!pubDate) {
        errors.push(
          `${sheetName} linha ${rowNum}: data da publicação inválida (${String(
            line[col.publicacao] ?? ""
          )}).`
        );
        return;
      }
      const title = col.titulo >= 0 ? String(line[col.titulo] ?? "").trim() : "";
      const status = col.status >= 0 ? parseStatus(line[col.status]) : null;
      if (col.status >= 0 && status === null && String(line[col.status] ?? "").trim()) {
        errors.push(
          `${sheetName} linha ${rowNum}: status desconhecido "${String(
            line[col.status]
          )}" — mantido Planejamento.`
        );
      }

      const existing = mandatoryIndex.get(`${categoryId}|${series.id}|${pubDate}`);
      rows.push({
        categoryId,
        seriesId: series.id,
        seriesName: series.name,
        plannedDate: planDate ?? pubDate,
        publicationDate: pubDate,
        title,
        status,
        matchedExisting: !!existing,
        existingId: existing?.id,
      });
      parsedAny = true;
    });
  });

  if (!parsedAny && errors.length === 0) {
    errors.push("Nenhuma linha válida encontrada no arquivo.");
  }

  return { rows, errors };
}

/** Constrói o objeto completo de uma nova publicação importada. */
export function buildPublicationFromImportedRow(
  row: ImportedRow
): Omit<Publication, "id" | "createdAt" | "updatedAt"> {
  return {
    title: row.title || `Publicação ${row.seriesName}`,
    description: "",
    categoryId: row.categoryId,
    seriesId: row.seriesId,
    status: row.status ?? "PLANEJAMENTO",
    priority: "MEDIA" as Priority,
    publicationDate: row.publicationDate!,
    plannedDate: row.plannedDate ?? row.publicationDate!,
    tags: ["obrigatoria", "plano-anual", "importado-excel"],
    isDeleted: false,
  };
}
