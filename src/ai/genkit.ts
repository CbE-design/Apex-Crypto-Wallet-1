
import { genkit } from 'genkit';
import { googleAI, gemini15Flash } from '@genkit-ai/googleai';

// 1. Detect if Next.js is in the middle of a production compilation sweep
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';
const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;

export const ai = genkit({
  plugins: [
    // Only load the plugin if we have a key and are NOT in the static build phase
    ...(isBuildPhase || !apiKey ? [] : [googleAI({ apiKey })])
  ],
  model: gemini15Flash, // Stable 1.5 flash model
});

// --- PERSONALIZED SYSTEM PROMPTS ---

const CUSTOMER_SUPPORT_PROMPT = `
You are the Apex Crypto Wallet Customer Support Assistant. 
Your primary job is to help users troubleshoot wallet issues, understand transaction statuses, manage security configurations, and navigate the application dashboard. 
Keep your responses helpful, clear, and secure. Do not offer financial or trade advice.
`;

const TRADE_ADVISOR_PROMPT = `
You are the Apex Trade Advisor, an advanced crypto market strategist and educational coach. 
Your goal is to guide users on how to begin trading, explain technical concepts (such as market vs. limit orders, market capitalization, dollar-cost averaging, and liquidity), and discuss generic market conditions.
Maintain an encouraging and educational tone. 
CRITICAL: You must always append a standard short disclaimer at the bottom of any message discussing market trends or tokens (e.g., "Disclaimer: Educational purposes only. Not financial advice.").
`;

// --- MULTI-AGENT CHAT FLOW ---

export const chatFlow = ai.defineFlow(
  {
    name: 'chatFlow',
    inputSchema: ai.z.object({
      message: ai.z.string(),
      history: ai.z.array(ai.z.any()).optional(),
      mode: ai.z.enum(['support', 'trade_advisor']).default('support'),
    }),
  },
  async (input) => {
    const systemInstruction = 
      input.mode === 'trade_advisor' 
        ? TRADE_ADVISOR_PROMPT 
        : CUSTOMER_SUPPORT_PROMPT;

    const response = await ai.generate({
      model: gemini15Flash,
      prompt: input.message,
      history: input.history,
      config: {
        systemInstruction: systemInstruction,
        temperature: input.mode === 'trade_advisor' ? 0.4 : 0.1, 
      },
    });

    return response.text;
  }
);
