
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
import {
  GetExchangeRateInputSchema,
  type GetExchangeRateInput,
  GetExchangeRateOutputSchema,
  type GetExchangeRateOutput,
} from '@/lib/types';

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
