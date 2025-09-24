'use server';

/**
 * @fileOverview An AI agent that summarizes cryptocurrency news.
 *
 * - cryptoNewsSummary - A function that generates a cryptocurrency news summary.
 * - CryptoNewsSummaryInput - The input type for the cryptoNewsSummary function.
 * - CryptoNewsSummaryOutput - The return type for the cryptoNewsSummary function.
 */

import {ai} from '@/ai/genkit';
import {googleAI} from '@genkit-ai/googleai';
import {z} from 'genkit';

const CryptoNewsSummaryInputSchema = z.object({
  portfolioAssets: z
    .array(z.string())
    .describe('A list of cryptocurrency symbols in the user portfolio.'),
  topCryptocurrencies: z
    .array(z.string())
    .describe('A list of top cryptocurrency symbols.'),
});
export type CryptoNewsSummaryInput = z.infer<typeof CryptoNewsSummaryInputSchema>;

const CryptoNewsSummaryOutputSchema = z.object({
  summary: z
    .string()
    .describe('A concise, AI-generated summary of the latest cryptocurrency news.'),
});
export type CryptoNewsSummaryOutput = z.infer<typeof CryptoNewsSummaryOutputSchema>;

export async function cryptoNewsSummary(
  input: CryptoNewsSummaryInput
): Promise<CryptoNewsSummaryOutput> {
  return cryptoNewsSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'cryptoNewsSummaryPrompt',
  model: googleAI('gemini-1.5-flash-latest'),
  input: {schema: CryptoNewsSummaryInputSchema},
  output: {schema: CryptoNewsSummaryOutputSchema},
  prompt: `You are a cryptocurrency news summarization expert.

  You will provide a concise, AI-generated summary of the latest cryptocurrency news relevant to the user's portfolio and the top cryptocurrencies.
  The summary should be free from hype and shilling, and should be neutral.

  User's Portfolio Assets: {{portfolioAssets}}
  Top Cryptocurrencies: {{topCryptocurrencies}}

  Summary:`,
});

const cryptoNewsSummaryFlow = ai.defineFlow(
  {
    name: 'cryptoNewsSummaryFlow',
    inputSchema: CryptoNewsSummaryInputSchema,
    outputSchema: CryptoNewsSummaryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
