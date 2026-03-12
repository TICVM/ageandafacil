'use server';
/**
 * @fileOverview An AI assistant that helps teachers generate detailed briefs for photo session bookings in Portuguese.
 *
 * - aiSessionBriefAssistant - A function that generates a detailed brief from teacher's notes.
 * - AISessionBriefAssistantInput - The input type for the aiSessionBriefAssistant function.
 * - AISessionBriefAssistantOutput - The return type for the aiSessionBriefAssistant function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AISessionBriefAssistantInputSchema = z.object({
  briefNotes: z
    .string()
    .describe("Teacher's brief notes for the photo session. These notes will be expanded into a detailed brief."),
  className: z.string().describe('The name of the class for which the photo session is booked.'),
  segmentName: z
    .string()
    .describe('The segment of the school (e.g., Educação Infantil, Ensino Fundamental I) for context.'),
  locationName: z.string().describe('The location where the photo session will take place.'),
});
export type AISessionBriefAssistantInput = z.infer<typeof AISessionBriefAssistantInputSchema>;

const AISessionBriefAssistantOutputSchema = z.object({
  detailedBrief: z.string().describe('A comprehensive and detailed brief for the marketing team.'),
  keyActivities: z.array(z.string()).describe('A list of key activities planned for the session.'),
  preferredShots: z.array(z.string()).describe('A list of preferred shots or compositions.'),
  desiredMood: z.string().describe('A description of the desired mood or atmosphere for the photos.'),
});
export type AISessionBriefAssistantOutput = z.infer<typeof AISessionBriefAssistantOutputSchema>;

export async function aiSessionBriefAssistant(
  input: AISessionBriefAssistantInput
): Promise<AISessionBriefAssistantOutput> {
  return aiSessionBriefAssistantFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiSessionBriefAssistantPrompt',
  input: { schema: AISessionBriefAssistantInputSchema },
  output: { schema: AISessionBriefAssistantOutputSchema },
  prompt: `Você é um assistente de IA projetado para ajudar professores a criar briefings detalhados para sessões de fotos escolares para a equipe de marketing. Seu objetivo é expandir notas breves em uma descrição abrangente, incluindo atividades específicas, fotos preferidas e o clima desejado.

Contexto da sessão de fotos:
Turma: {{{className}}}
Segmento Escolar: {{{segmentName}}}
Local: {{{locationName}}}

Notas do Professor: """{{{briefNotes}}}"""

Com base no contexto e nas notas fornecidas, gere um briefing detalhado focando em:
1.  **Briefing Detalhado**: Uma descrição narrativa da sessão, o que estará acontecendo e quaisquer considerações especiais.
2.  **Atividades Principais**: Liste as principais atividades que ocorrerão durante a sessão.
3.  **Fotos Preferidas**: Sugira tipos específicos de fotos ou composições que o professor/escola gostaria de capturar.
4.  **Clima Desejado**: Descreva o sentimento ou atmosfera geral que as fotos devem transmitir.

TODA A SAÍDA DEVE SER EM PORTUGUÊS (PT-BR).

Por favor, estruture sua saída para fornecer claramente esses quatro elementos, aderindo ao esquema JSON especificado.`,
});

const aiSessionBriefAssistantFlow = ai.defineFlow(
  {
    name: 'aiSessionBriefAssistantFlow',
    inputSchema: AISessionBriefAssistantInputSchema,
    outputSchema: AISessionBriefAssistantOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
