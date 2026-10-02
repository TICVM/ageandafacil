import { Appointment, SchoolClass } from "./types";
import { Publication, PublicationStatus } from "../calendar/types";
import { mapAppointmentStatusToPublication } from "./status-mapping";

/**
 * Associação entre o Agendamento de Sessões Fotográficas (appointments) e o
 * Controle de Publicações (publications obrigatórias por série).
 *
 * Regra:
 *  - Disciplina de idioma (Inglês / Bilingual) → categoria "Programa Bilíngue"
 *  - Qualquer outra disciplina                → categoria "Atividades Variadas"
 *  - A série da publicação é derivada da turma da sessão (Pré A/B → Pré,
 *    2º Ano B → 2º Ano, 1ª Série → 1º Médio …).
 *  - Se a sessão estiver com status Confirmado ou Concluído, a publicação
 *    correspondente muda para "AGENDADO". Se for Publicada no scheduler
 *    ("PUBLICADO"), a publicação também passa para "PUBLICADO".
 */

export const AV_CATEGORY_ID = "ATIVIDADES_VARIADAS";
export const PB_CATEGORY_ID = "PROGRAMA_BILINGUE";

const BILINGUE_SUBJECT_RE = /(ingl[eê]s|bil[ií]ngue|bilingual|english|spanish|espanhol|fr[eê]s)/i;

export function isBilingualSubject(subject?: string | null): boolean {
  if (!subject) return false;
  return BILINGUE_SUBJECT_RE.test(subject);
}

/** Resolve o nome atual da turma: pelo ID em school_classes, senão o campo className. */
export function resolveClassName(apt: Appointment, classes: SchoolClass[]): string {
  const byId = apt.schoolClassId
    ? classes.find((c) => c.id === apt.schoolClassId)?.name
    : undefined;
  return byId || apt.className || "";
}

/**
 * Extrai a SERIE_ID do calendário a partir do nome da turma.
 * Exemplos: "Maternal A" → MATERNAL, "Pré B" → PRE, "3º Ano C" → ANO_3,
 *           "9o ano" → ANO_9, "1ª Série / 1º EM" → MEDIO_1,
 *           "Terceirão / Formandos" → MEDIO_3.
 */
export function seriesFromClassName(name: string): string | null {
  const norm = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // remove acentos (pré→pre, inglês→ingles)

  const has = (re: RegExp) => re.test(norm);

  if (has(/maternal|matern[ao]?\b/)) return "MATERNAL";
  if (has(/\bjardim\b|jardim\s?[ia b]|j1|j2|j3/)) return "JARDIM";
  if (has(/\bpre\b|pre-?\s?[ia b]\b|preescol|pr[eé]z/)) return "PRE";

  // Médias / Ensino Médio — precisa vir antes do "Ano X" genérico
  if (has(/terceir|formando|3[a°º]?\s?(em|serie|s[eé]rie)\b|medio\s?3|3\s?medio|m3/)) return "MEDIO_3";
  if (has(/2[a°º]?\s?(em|serie|s[eé]rie)\b|medio\s?2|2\s?medio|m2/)) return "MEDIO_2";
  if (has(/1[a°º]?\s?(em|serie|s[eé]rie)\b|medio\s?1|1\s?medio|m1|ensino\s?medio/)) return "MEDIO_1";

  // Anos 1º a 9º ("1º Ano A", "2ano", "5a serie fundamental"…)
  const m = norm.match(/([1-9])\s*[\ba-z]*\s*(ano|anos|series?|s[eé]rie|fundamental|f\d)?/);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 9 && has(/ano|serie|s[eé]rie|fundamento|basic/)) {
      return `ANO_${n}`;
    }
  }
  return null;
}

export interface LinkInfo {
  appointmentId: string;
  categoryId: string;
  seriesId: string;
}

/** Constrói o identificador de vínculo gravado na publicação. */
export function linkKey(appointmentId: string): string {
  return `apt:${appointmentId}`;
}

/** Lê os vínculos já registrados em uma publicação. */
export function getLinkedKeys(pub: Publication): string[] {
  return (pub.tags ?? []).filter((t) => t.startsWith("apt:"));
}

/** Statuses de sessão que NÃO participam da associação automática. */
const EXCLUDED_STATUSES = new Set<string>(["CANCELLED"]);

/**
 * Para cada sessão vinculável (Pendente/Editar/Aprovação/Aprovado/Confirmado/
 * Concluído/Publicado/Reagendado), determina qual publicação obrigatória
 * (categoria + série) deve ser associada. Canceladas ficam de fora; sessões
 * reagendadas / com pedido de reagendamento entram como "REPROGRAMADO".
 * O status é normalizado — no Firestore pode estar gravado em inglês
 * minúsculo ("confirmed", "pending", "approved" …).
 */
export function computeAssociations(
  appointments: Appointment[],
  classes: SchoolClass[]
): LinkInfo[] {
  const out: LinkInfo[] = [];
  for (const apt of appointments) {
    const st = normalizeAppointmentStatus(apt.status);
    if (st && EXCLUDED_STATUSES.has(st)) continue;
    const className = resolveClassName(apt, classes);
    const seriesId = seriesFromClassName(className);
    if (!seriesId) continue;
    const categoryId = isBilingualSubject(apt.subject) ? PB_CATEGORY_ID : AV_CATEGORY_ID;
    out.push({ appointmentId: apt.id, categoryId, seriesId });
  }
  return out;
}

/**
 * Status-alvo da publicação dado o status da sessão agendada
 * (mapeamento completo — ver status-mapping.ts):
 *  Editar/Pendente → Produção de Conteúdo · Em aprovação → Revisão/Aprovação
 *  Aprovado → Aprovado para publicar · Confirmado → Agendado · Publicado → Publicado
 *  Reagendado / Pedido de reagendamento → Reprogramado
 */
export function targetPublicationStatus(apt: Appointment): PublicationStatus {
  return mapAppointmentStatusToPublication(apt.status);
}
