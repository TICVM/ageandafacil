import { AppointmentStatus } from "./types";
import { PublicationStatus } from "../calendar/types";

/**
 * Mapeamento entre os status do Agendamento de Sessões Fotográficas e os
 * status do Controle de Publicações.
 *
 *  Sessão (scheduler)              →  Publicação (calendário)
 *  ------------------------------------------------------------------
 *  Pendente / Editar / sem texto   →  Produção de Conteúdo
 *  Em aprovação                   →  Revisão / Aprovação
 *  Aprovado                        →  Aprovado para publicar
 *  Confirmado                      →  Agendado
 *  Publicado                       →  Publicado
 *
 * A conversão inversa (publicação → sessão) segue as mesmas duplas,
 * respeitando a hierarquia de cada fluxo.
 */

export const STATUS_PAIRS: Array<{
  apt: AppointmentStatus;
  aptLabel: string;
  pub: PublicationStatus;
  pubLabel: string;
}> = [
  { apt: "PENDING", aptLabel: "Pendente", pub: "PRODUCAO_CONTEUDO", pubLabel: "Produção de Conteúdo" },
  { apt: "EDITAR", aptLabel: "Editar", pub: "PRODUCAO_CONTEUDO", pubLabel: "Produção de Conteúdo" },
  { apt: "APROVACAO", aptLabel: "Em aprovação", pub: "REVISAO_APROVACAO", pubLabel: "Revisão / Aprovação" },
  { apt: "APROVADO", aptLabel: "Aprovado", pub: "APROVADO_PARA_PUBLICAR", pubLabel: "Aprovado para publicar" },
  { apt: "CONFIRMED", aptLabel: "Confirmado", pub: "AGENDADO", pubLabel: "Agendado" },
  { apt: "PUBLICADO", aptLabel: "Publicado", pub: "PUBLICADO", pubLabel: "Publicado" },
  { apt: "REPROGRAMADO", aptLabel: "Reprogramado", pub: "REPROGRAMADO", pubLabel: "Reprogramado" },
];

/**
 * Normaliza o status vindo do Firestore para as chaves internas.
 * No banco os status podem estar em inglês minúsculo ("confirmed",
 * "pending", "approved", "published", "rescheduled" etc.) ou com grafias
 * alternativas — todos são convertidos antes do mapeamento.
 */
const APPT_ALIAS: Record<string, AppointmentStatus> = {
  // português
  pendente: "PENDING",
  editar: "EDITAR",
  aprovacao: "APROVACAO",
  aprova: "APROVACAO",
  emaprovacao: "APROVACAO",
  revisao: "APROVACAO",
  revisaoaprovacao: "APROVACAO",
  aprovado: "APROVADO",
  aprovadoparapublicar: "APROVADO",
  confirmado: "CONFIRMED",
  agendado: "CONFIRMED",
  concluido: "COMPLETED",
  cancelado: "CANCELLED",
  reagendado: "REPROGRAMADO",
  reprogramado: "REPROGRAMADO",
  solicitadoreagendamento: "REPROGRAMADO",
  solicitacaoreagendamento: "REPROGRAMADO",
  pedidoreagendamento: "REPROGRAMADO",
  publicado: "PUBLICADO",
  publicados: "PUBLICADO",
  // inglês (como gravado no banco)
  pending: "PENDING",
  edit: "EDITAR",
  editing: "EDITAR",
  notext: "EDITAR",
  no_text: "EDITAR",
  approval: "APROVACAO",
  in_approval: "APROVACAO",
  approved: "APROVADO",
  confirmed: "CONFIRMED",
  completed: "COMPLETED",
  cancelled: "CANCELLED",
  canceled: "CANCELLED",
  rescheduled: "REPROGRAMADO",
  re_scheduled: "REPROGRAMADO",
  reschedule_request: "REPROGRAMADO",
  re_schedule_request: "REPROGRAMADO",
  requested_reschedule: "REPROGRAMADO",
  published: "PUBLICADO",
};

function normalizeKey(value: string | null | undefined): string {
  return (value ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[\s/]+/g, "_");
}

/** Converte qualquer grafia de status de sessão para a chave interna. */
export function normalizeAppointmentStatus(
  raw: string | null | undefined
): AppointmentStatus | null {
  if (!raw) return null;
  const trimmed = raw.toString().trim();
  const upper = trimmed.toUpperCase().replace(/[\s/-]+/g, "_") as AppointmentStatus;
  // Já é uma chave válida?
  const valid: string[] = [
    "PENDING", "EDITAR", "APROVACAO", "APROVADO", "CONFIRMED",
    "CANCELLED", "RESCHEDULED", "RE_SCHEDULE_REQUEST", "COMPLETED",
    "PUBLICADO", "REPROGRAMADO",
  ];
  if (valid.includes(upper)) {
    // RESCHEDULED / RE_SCHEDULE_REQUEST no banco = pedido/reagendamento → Reprogramado
    if (upper === "RESCHEDULED" || upper === "RE_SCHEDULE_REQUEST") return "REPROGRAMADO";
    return upper;
  }
  const alias = APPT_ALIAS[normalizeKey(trimmed)];
  return alias ?? null;
}

/** Converte qualquer grafia de status de publicação para a chave interna. */
export function normalizePublicationStatus(
  raw: string | null | undefined
): PublicationStatus | null {
  if (!raw) return null;
  const trimmed = raw.toString().trim();
  const key = normalizeKey(trimmed);
  const direct: Record<string, PublicationStatus> = {
    planejamento: "PLANEJAMENTO",
  };
  if (direct[key]) return direct[key];
  // Chave em maiúsculo sem acentos (ex.: PRODUCAO_CONTEUDO)
  const upper = trimmed.toUpperCase().replace(/[\s-]+/g, "_");
  const validPub: string[] = [
    "PLANEJAMENTO", "PRODUCAO_CONTEUDO", "REVISAO_APROVACAO",
    "APROVADO_PARA_PUBLICAR", "AGENDADO", "PUBLICADO", "REPROGRAMADO",
  ];
  if (validPub.includes(upper)) return upper as PublicationStatus;
  // Mapas por rótulo pt-BR
  const byLabel: Record<string, PublicationStatus> = {
    producao_conteudo: "PRODUCAO_CONTEUDO",
    revisao_aprovacao: "REVISAO_APROVACAO",
    aprovado_para_publicar: "APROVADO_PARA_PUBLICAR",
    agendado: "AGENDADO",
    publicado: "PUBLICADO",
    reprogramado: "REPROGRAMADO",
  };
  return byLabel[key] ?? null;
}

/** Status da publicação correspondente ao status da sessão fotográfica. */
export function mapAppointmentStatusToPublication(
  apt: AppointmentStatus | string | null | undefined
): PublicationStatus {
  const norm =
    typeof apt === "string" ? normalizeAppointmentStatus(apt) : (apt ?? null);
  switch (norm) {
    case "PUBLICADO":
      return "PUBLICADO";
    case "CONFIRMED":
    case "COMPLETED": // concluído trata-se como confirmado/agendado
      return "AGENDADO";
    case "APROVADO":
      return "APROVADO_PARA_PUBLICAR";
    case "APROVACAO":
      return "REVISAO_APROVACAO";
    case "REPROGRAMADO":
      return "REPROGRAMADO";
    case "PENDING":
    case "EDITAR":
    default:
      // "Editar", "Sem texto", pendente ou status desconhecido → produção de conteúdo
      return "PRODUCAO_CONTEUDO";
  }
}

/** Status da sessão fotográfica correspondente ao status da publicação. */
export function mapPublicationStatusToAppointment(
  pub: PublicationStatus | string | null | undefined
): AppointmentStatus {
  const norm =
    typeof pub === "string" ? normalizePublicationStatus(pub) : (pub ?? null);
  switch (norm) {
    case "PUBLICADO":
      return "PUBLICADO";
    case "AGENDADO":
      return "CONFIRMED";
    case "APROVADO_PARA_PUBLICAR":
      return "APROVADO";
    case "REVISAO_APROVACAO":
      return "APROVACAO";
    case "REPROGRAMADO":
      return "REPROGRAMADO";
    case "PRODUCAO_CONTEUDO":
      return "EDITAR";
    case "PLANEJAMENTO":
    default:
      return "PENDING";
  }
}

/** Rótulos em pt-BR dos status de sessão (inclui grafias do banco). */
export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  EDITAR: "Editar",
  APROVACAO: "Em aprovação",
  APROVADO: "Aprovado",
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
  RESCHEDULED: "Reprogramado",
  RE_SCHEDULE_REQUEST: "Reprogramado",
  REPROGRAMADO: "Reprogramado",
  COMPLETED: "Concluído",
  PUBLICADO: "Publicado",
  // aliases vindos do banco (inglês)
  pending: "Pendente",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
  rescheduled: "Reprogramado",
  re_schedule_request: "Reprogramado",
  edit: "Editar",
  no_text: "Editar",
  approval: "Em aprovação",
  approved: "Aprovado",
  published: "Publicado",
};
