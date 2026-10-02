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
];

/** Status da publicação correspondente ao status da sessão fotográfica. */
export function mapAppointmentStatusToPublication(
  apt: AppointmentStatus | string | null | undefined
): PublicationStatus {
  switch (apt) {
    case "PUBLICADO":
      return "PUBLICADO";
    case "CONFIRMED":
    case "COMPLETED": // concluído trata-se como confirmado/agendado
      return "AGENDADO";
    case "APROVADO":
      return "APROVADO_PARA_PUBLICAR";
    case "APROVACAO":
      return "REVISAO_APROVACAO";
    case "PENDING":
    case "EDITAR":
    default:
      // "Editar", pendente ou status sem texto → produção de conteúdo
      return "PRODUCAO_CONTEUDO";
  }
}

/** Status da sessão fotográfica correspondente ao status da publicação. */
export function mapPublicationStatusToAppointment(
  pub: PublicationStatus | string | null | undefined
): AppointmentStatus {
  switch (pub) {
    case "PUBLICADO":
      return "PUBLICADO";
    case "AGENDADO":
      return "CONFIRMED";
    case "APROVADO_PARA_PUBLICAR":
      return "APROVADO";
    case "REVISAO_APROVACAO":
      return "APROVACAO";
    case "PRODUCAO_CONTEUDO":
      return "EDITAR";
    case "PLANEJAMENTO":
    default:
      return "PENDING";
  }
}

/** Rótulos em pt-BR dos novos status de sessão. */
export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  EDITAR: "Editar",
  APROVACAO: "Em aprovação",
  APROVADO: "Aprovado",
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
  RESCHEDULED: "Reagendado",
  RE_SCHEDULE_REQUEST: "Pedido de reagendamento",
  COMPLETED: "Concluído",
  PUBLICADO: "Publicado",
};
