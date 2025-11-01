
import { z } from 'zod';

export interface PortfolioAsset {
  symbol: string;
  name: string;
  amount: number;
  valueUSD: number;
  priceUSD: number;
  change24h: number;
  icon: string;
}

export interface MarketCoin {
  symbol: string;
  name: string;
  priceUSD: number;
  change24h: number;
  marketCap: number;
  icon: string;
}

export interface Transaction {
  id: string;
  type: 'Buy' | 'Sell';
  asset: string;
  amount: number;
  valueUSD: number;
  date: string;
  status: 'Completed' | 'Pending' | 'Failed';
}

export interface PriceAlert {
  id: string;
  userId: string;
  currency: string;
  thresholdPrice: number;
  alertType: 'Above' | 'Below';
  triggered: boolean;
  asset?: string; // These are for display only
  targetPrice?: number;
  type?: 'Above' | 'Below';
  status?: 'Active' | 'Triggered';
  icon?: string;
}

// Schema for GetExchangeRate flow
export const GetExchangeRateInputSchema = z.object({
  fromAsset: z.string().describe('The symbol of the cryptocurrency to convert from.'),
  toAsset: z.string().describe('The symbol of the cryptocurrency to convert to.'),
});
export type GetExchangeRateInput = z.infer<typeof GetExchangeRateInputSchema>;

export const GetExchangeRateOutputSchema = z.object({
  rate: z.number().describe('The exchange rate from the "from" asset to the "to" asset.'),
});
export type GetExchangeRateOutput = z.infer<typeof GetExchangeRateOutputSchema>;
