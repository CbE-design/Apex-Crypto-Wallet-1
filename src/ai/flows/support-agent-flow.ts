
'use server';

/**
 * @fileOverview An AI agent that acts as a customer support assistant.
 *
 * - supportAgent - A function that generates a response to a user's support query.
 * - SupportAgentInput - The input type for the supportAgent function.
 * - SupportAgentOutput - The return type for the supportAgent function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const SupportAgentInputSchema = z.object({
  query: z.string().describe("The user's question for the support agent."),
  history: z.array(z.object({
    role: z.enum(['user', 'model']),
    content: z.string(),
  })).optional().describe('The previous conversation history.'),
});
export type SupportAgentInput = z.infer<typeof SupportAgentInputSchema>;

export const SupportAgentOutputSchema = z.object({
  response: z
    .string()
    .describe('A helpful and friendly response to the user\'s query.'),
});
export type SupportAgentOutput = z.infer<typeof SupportAgentOutputSchema>;

export async function supportAgent(
  input: SupportAgentInput
): Promise<SupportAgentOutput> {
  return supportAgentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'supportAgentPrompt',
  input: {schema: SupportAgentInputSchema},
  output: {schema: SupportAgentOutputSchema},
  prompt: `You are a friendly, helpful, and knowledgeable AI customer support agent for "Apex Crypto Wallet", a modern cryptocurrency wallet application.

Your goal is to provide excellent support by answering user questions clearly and concisely.

- If a user asks how to do something, provide simple, step-by-step instructions.
- If a user reports a problem, be empathetic and offer troubleshooting suggestions.
- If you don't know the answer, say so honestly. Do not make things up.
- Keep your answers brief and to the point.

Conversation History:
{{#if history}}
{{#each history}}
{{role}}: {{content}}
{{/each}}
{{/if}}

User's new question: {{query}}

Your Response:`,
});

const supportAgentFlow = ai.defineFlow(
  {
    name: 'supportAgentFlow',
    inputSchema: SupportAgentInputSchema,
    outputSchema: SupportAgentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
