
'use server';
/**
 * @fileOverview An AI flow for calculating cryptocurrency exchange rates.
 *
 * - getExchangeRate - A function that fetches live prices and calculates the exchange rate.
 * - GetExchangeRateInput - The input type for the getExchangeRate function.
 * - GetExchangeRateOutput - The return type for the getExchangeRate function.
 */

import { ai } from '@/ai/genkit';
import { getLivePrices } from '@/services/crypto-service';
import { z } from 'genkit';

export const GetExchangeRateInputSchema = z.object({
  fromAsset: z.string().describe('The symbol of the cryptocurrency to convert from.'),
  toAsset: z.string().describe('The symbol of the cryptocurrency to convert to.'),
});
export type GetExchangeRateInput = z.infer<typeof GetExchangeRateInputSchema>;

export const GetExchangeRateOutputSchema = z.object({
  rate: z.number().describe('The exchange rate from the "from" asset to the "to" asset.'),
});
export type GetExchangeRateOutput = z.infer<typeof GetExchangeRateOutputSchema>;

export async function getExchangeRate(
  input: GetExchangeRateInput
): Promise<GetExchangeRateOutput> {
  return getExchangeRateFlow(input);
}

const getExchangeRateFlow = ai.defineFlow(
  {
    name: 'getExchangeRateFlow',
    inputSchema: GetExchangeRateInputSchema,
    outputSchema: GetExchangeRateOutputSchema,
  },
  async ({ fromAsset, toAsset }) => {
    if (fromAsset === toAsset) {
        return { rate: 1 };
    }

    const prices = await getLivePrices([fromAsset, toAsset]);
    
    const fromPrice = prices[fromAsset];
    const toPrice = prices[toAsset];

    if (!fromPrice || !toPrice || toPrice === 0) {
        console.error(`Could not retrieve prices for ${fromAsset} or ${toAsset}`);
        return { rate: 0 };
    }

    const rate = fromPrice / toPrice;
    return { rate };
  }
);
