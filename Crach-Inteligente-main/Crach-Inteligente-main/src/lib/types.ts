
import { type BadgeStyleConfig } from "./badge-styles";

export interface Student {
  id: string;
  nome: string;
  matricula: string;
  segmento: string;
  turma: string;
  fotoUrl: string; // Base64 data URL ou link externo
  customData?: { [key: string]: string };
  modeloId?: string; // ID do modelo de crachá vinculado
  enabled?: boolean; // Selecionado para impressão (Check azul)
  visivelFila?: boolean; // Visível no Gerenciador de Crachás
  ativo?: boolean; // Matriculado/Ativo na escola
}

export interface BadgeModel {
  id: string;
  nomeModelo: string;
  fundoCrachaUrl: string;
  badgeStyle: BadgeStyleConfig;
  userId?: string;
}

export interface SchoolSegment {
  id: string;
  nome: string;
  ordem: number;
}

export interface SchoolClass {
  id: string;
  nome: string;
  segmentoId: string;
  ordem: number;
}

export interface SystemConfig {
  id: string;
  logoUrl?: string;
  logoHeight?: number;
  apiSecret?: string;
  sigaUrl?: string;
  sigaToken?: string;
  sigaUsername?: string;
  sigaPassword?: string;
}
