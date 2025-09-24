'use server';

/**
 * @fileOverview An AI agent that acts as a cryptocurrency assistant.
 *
 * - cryptoAssistant - A function that generates a response to a user's crypto-related query.
 * - CryptoAssistantInput - The input type for the cryptoAssistant function.
 * - CryptoAssistantOutput - The return type for the cryptoAssistant function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CryptoAssistantInputSchema = z.object({
  query: z.string().describe('The user\'s question about cryptocurrency.'),
});
export type CryptoAssistantInput = z.infer<typeof CryptoAssistantInputSchema>;

const CryptoAssistantOutputSchema = z.object({
  response: z
    .string()
    .describe('A helpful and informative response to the user\'s query.'),
});
export type CryptoAssistantOutput = z.infer<typeof CryptoAssistantOutputSchema>;

export async function cryptoAssistant(
  input: CryptoAssistantInput
): Promise<CryptoAssistantOutput> {
  return cryptoAssistantFlow(input);
}

const prompt = ai.definePrompt({
  name: 'cryptoAssistantPrompt',
  input: {schema: CryptoAssistantInputSchema},
  output: {schema: CryptoAssistantOutputSchema},
  prompt: `You are a friendly and knowledgeable cryptocurrency assistant.

  Your role is to provide clear, concise, and unbiased answers to questions about cryptocurrencies, blockchain technology, and market trends. Avoid financial advice, hype, and speculation.

  User's Question: {{query}}

  Your Response:`,
});

const cryptoAssistantFlow = ai.defineFlow(
  {
    name: 'cryptoAssistantFlow',
    inputSchema: CryptoAssistantInputSchema,
    outputSchema: CryptoAssistantOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
