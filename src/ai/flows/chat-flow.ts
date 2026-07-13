import { z } from 'zod';
import { ai, gemini15Flash } from '../genkit';

const CUSTOMER_SUPPORT_PROMPT = `You are the Apex Crypto Wallet Customer Support Assistant...`;
const TRADE_ADVISOR_PROMPT = `You are the Apex Trade Advisor...`;

export const chatFlow = ai.defineFlow(
  {
    name: 'chatFlow',
    inputSchema: z.object({
      message: z.string(),
      history: z.array(z.any()).optional(),
      mode: z.enum(['support', 'trade_advisor']).default('support'),
    }),
  },
  async (input: any) => {
    const systemInstruction = input.mode === 'trade_advisor' ? TRADE_ADVISOR_PROMPT : CUSTOMER_SUPPORT_PROMPT;
    const response = await ai.generate({
      model: gemini15Flash,
      prompt: input.message,
      history: input.history || [],
      config: {
        systemInstruction: systemInstruction,
        temperature: input.mode === 'trade_advisor' ? 0.4 : 0.1,
      },
    } as any);
    return response.text;
  }
);
