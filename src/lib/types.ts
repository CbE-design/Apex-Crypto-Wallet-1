
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
  type: 'Buy' | 'Sell' | 'Withdrawal';
  amount: number;
  price: number;
  status: 'Completed' | 'Pending' | 'Failed';
  notes?: string;
  sender?: string;
  recipient?: string;
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
  fiatCurrency: z.string().optional().describe('The target fiat currency symbol (e.g., "USD", "EUR", "ZAR"). Defaults to USD.'),
});
export type GetExchangeRateInput = z.infer<typeof GetExchangeRateInputSchema>;

export const GetExchangeRateOutputSchema = z.object({
  rate: z.number().describe('The exchange rate from the "from" asset to the "to" asset.'),
});
export type GetExchangeRateOutput = z.infer<typeof GetExchangeRateOutputSchema>;

// Schema for SupportAgent flow
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

// Schema for CryptoAssistant flow
export const CryptoAssistantInputSchema = z.object({
  query: z.string().describe("The user's question about cryptocurrency."),
});
export type CryptoAssistantInput = z.infer<typeof CryptoAssistantInputSchema>;

export const CryptoAssistantOutputSchema = z.object({
  response: z
    .string()
    .describe('A helpful and informative response to the user\'s query.'),
});
export type CryptoAssistantOutput = z.infer<typeof CryptoAssistantOutputSchema>;

export interface Currency {
    symbol: string;
    name: string;
}
