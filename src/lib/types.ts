
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
  type: 'Buy' | 'Sell' | 'Withdrawal' | 'Swap' | 'Internal Transfer';
  amount: number;
  price: number;
  status: 'Completed' | 'Pending' | 'Failed' | 'Reconciling';
  timestamp: any;
  notes?: string;
  sender?: string;
  recipient?: string;
  metadata?: {
    travelRuleVerified: boolean;
    complianceId?: string;
    protocol?: string;
  };
}

export interface PriceAlert {
  id: string;
  userId: string;
  currency: string;
  thresholdPrice: number;
  alertType: 'Above' | 'Below';
  triggered: boolean;
}

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

export const SendNotificationInputSchema = z.object({
  title: z.string().describe('The title of the notification.'),
  body: z.string().describe('The body content of the notification.'),
});
export type SendNotificationInput = z.infer<typeof SendNotificationInputSchema>;

export const SendNotificationOutputSchema = z.object({
  successCount: z.number().describe('The number of messages that were sent successfully.'),
  failureCount: z.number().describe('The number of messages that could not be sent.'),
});
export type SendNotificationOutput = z.infer<typeof SendNotificationOutputSchema>;

export const SendEmailInputSchema = z.object({
  subject: z.string().describe('The subject of the email.'),
  body: z.string().describe('The HTML body content of the email.'),
});
export type SendEmailInput = z.infer<typeof SendEmailInputSchema>;

export const SendEmailOutputSchema = z.object({
  success: z.boolean().describe('Whether the email sending was initiated successfully.'),
  message: z.string().describe('A summary message of the result.'),
});
export type SendEmailOutput = z.infer<typeof SendEmailOutputSchema>;

export interface Currency {
    symbol: string;
    name: string;
}
