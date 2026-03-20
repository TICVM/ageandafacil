'use server';
/**
 * @fileOverview Fluxo de IA para identificação de alunos via reconhecimento facial.
 * 
 * - identifyStudent: Compara uma foto capturada com uma lista de candidatos, incluindo suas fotos de referência.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const IdentifyStudentInputSchema = z.object({
  photoDataUri: z.string().describe("Foto capturada da webcam em formato Base64 data URI."),
  candidates: z.array(z.object({
    id: z.string(),
    nome: z.string(),
    fotoUrl: z.string().optional()
  })).max(30).describe("Lista de alunos candidatos para comparação visual.")
});

const IdentifyStudentOutputSchema = z.object({
  studentId: z.string().nullable().describe("ID do aluno identificado ou null se não houver certeza."),
  confidence: z.number().describe("Nível de confiança da identificação (0 a 1)."),
  reasoning: z.string().describe("Explicação técnica das características faciais coincidentes.")
});

export type IdentifyStudentInput = z.infer<typeof IdentifyStudentInputSchema>;
export type IdentifyStudentOutput = z.infer<typeof IdentifyStudentOutputSchema>;

export async function identifyStudent(input: IdentifyStudentInput): Promise<IdentifyStudentOutput> {
  return identifyStudentFlow(input);
}

const identifyStudentFlow = ai.defineFlow(
  {
    name: 'identifyStudentFlow',
    inputSchema: IdentifyStudentInputSchema,
    outputSchema: IdentifyStudentOutputSchema,
  },
  async (input) => {
    // Filtramos apenas candidatos que possuem foto e limitamos para não exceder limites de contexto
    const validCandidates = input.candidates.filter(c => !!c.fotoUrl && c.fotoUrl.startsWith('data:')).slice(0, 20);

    if (validCandidates.length === 0) {
      return { studentId: null, confidence: 0, reasoning: "Nenhum candidato com foto de referência válida foi fornecido." };
    }

    const { output } = await ai.generate({
      prompt: [
        { text: "Você é um sistema biométrico de alta precisão. Analise a FOTO CAPTURADA (o alvo):" },
        { media: { url: input.photoDataUri } },
        { text: "Agora, compare o alvo com as fotos de referência destes alunos candidatos:" },
        ...validCandidates.flatMap(c => ([
          { text: `ID: ${c.id}, Nome: ${c.nome}` },
          { media: { url: c.fotoUrl! } }
        ])),
        { text: "INSTRUÇÕES: Identifique qual candidato é a mesma pessoa da FOTO CAPTURADA. Analise: 1. Formato do rosto; 2. Distância entre olhos; 3. Formato do nariz e boca. Se houver uma correspondência clara (confiança > 0.8), retorne o ID. Caso contrário, retorne null." }
      ],
      output: { schema: IdentifyStudentOutputSchema }
    });

    return output!;
  }
);
