'use server';

/**
 * @fileOverview An AI agent that acts as a cryptocurrency assistant.
 *
 * - cryptoAssistant - A function that generates a response to a user's crypto-related query.
 * - CryptoAssistantInput - The input type for the cryptoAssistant function.
 * - CryptoAssistantOutput - The return type for the cryptoAssistant function.
 */

import {ai} from '@/ai/genkit';
import {getLivePrices} from '@/services/crypto-service';
import {z} from 'genkit';

const CryptoAssistantInputSchema = z.object({
  query: z.string().describe("The user's question about cryptocurrency."),
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

const getLiveCryptoPricesTool = ai.defineTool(
  {
    name: 'getLiveCryptoPrices',
    description:
      'Get the current market price of one or more cryptocurrencies in USD.',
    inputSchema: z.object({
      symbols: z
        .array(z.string())
        .describe(
          'An array of cryptocurrency ticker symbols (e.g., ["BTC", "ETH"]).'
        ),
    }),
    outputSchema: z.record(z.number()),
  },
  async input => {
    return await getLivePrices(input.symbols);
  }
);

const prompt = ai.definePrompt({
  name: 'cryptoAssistantPrompt',
  input: {schema: CryptoAssistantInputSchema},
  output: {schema: CryptoAssistantOutputSchema},
  tools: [getLiveCryptoPricesTool],
  prompt: `You are a friendly and knowledgeable cryptocurrency assistant, powered by Google's Gemini model.

  Your role is to provide clear, concise, and unbiased answers to questions about cryptocurrencies, blockchain technology, market trends, and related topics.

  If the user asks for the price of a cryptocurrency, you MUST use the 'getLiveCryptoPrices' tool to get the real-time market data. Do not provide a price from your own knowledge.

  Avoid giving financial advice, making price predictions, or promoting any specific cryptocurrency. Your goal is to educate and inform.

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
