'use server';
/**
 * @fileOverview An AI assistant that helps teachers generate detailed briefs for photo session bookings.
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
  prompt: `You are an AI assistant designed to help teachers create detailed briefs for school photo sessions for the marketing team. Your goal is to expand brief notes into a comprehensive description, including specific activities, preferred shots, and the desired mood.

Context for the photo session:
Class: {{{className}}}
School Segment: {{{segmentName}}}
Location: {{{locationName}}}

Teacher's Brief Notes: """{{{briefNotes}}}"""

Based on the provided context and brief notes, generate a detailed brief focusing on:
1.  **Detailed Brief**: A narrative description of the session, what will be happening, and any special considerations.
2.  **Key Activities**: List the main activities that will occur during the session.
3.  **Preferred Shots**: Suggest specific types of photos or compositions the teacher/school would like to capture.
4.  **Desired Mood**: Describe the overall feeling or atmosphere the photos should convey.

Please structure your output to clearly provide these four elements, adhering to the specified JSON schema.`,
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
