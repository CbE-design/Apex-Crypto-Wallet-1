
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
  async ({ fromAsset, toAsset, fiatCurrency = 'USD' }) => {
    if (fromAsset === toAsset) {
        return { rate: 1 };
    }

    // We need prices relative to a common currency to calculate the cross-rate.
    const prices = await getLivePrices([fromAsset, toAsset], fiatCurrency);
    
    const fromPrice = prices[fromAsset];
    const toPrice = prices[toAsset];

    // Handle cases where one or both prices could not be fetched.
    if (fromPrice === undefined || toPrice === undefined) {
        // Attempt to get USD prices as a fallback
        const usdPrices = await getLivePrices([fromAsset, toAsset], 'USD');
        const fromUsdPrice = usdPrices[fromAsset];
        const toUsdPrice = usdPrices[toAsset];
        if(fromUsdPrice && toUsdPrice > 0) {
            return { rate: fromUsdPrice / toUsdPrice };
        }
        return { rate: 0 };
    }
    
    // Avoid division by zero.
    if (toPrice === 0) {
        return { rate: 0 };
    }

    // The exchange rate is the ratio of the 'from' asset's price to the 'to' asset's price.
    const rate = fromPrice / toPrice;
    
    return { rate };
  }
);
