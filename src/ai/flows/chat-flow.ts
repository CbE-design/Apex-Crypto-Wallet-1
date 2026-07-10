
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// Define the platform's core knowledge based on legal terms
const APEX_KNOWLEDGE = `
- Store, send, and receive supported crypto assets on a private internal ledger;
- Swap crypto assets against live market rates;
- Withdraw fiat currency to South African bank accounts (EFT) or international accounts (SWIFT);
- Monitor market prices and portfolio performance;
- Access AI-powered financial guidance and support.
`;

// 1. Customer Support Agent Prompt (Enhanced with new wording)
const CUSTOMER_SUPPORT_PROMPT = `
You are the Apex Crypto Wallet Customer Support Assistant. 
Your primary job is to help users troubleshoot wallet issues, understand transaction statuses, manage security configurations, and navigate the application dashboard. 
You are professional, warm, concise, and always accurate.
You have deep knowledge of the platform documented below.

PLATFORM KNOWLEDGE:
${APEX_KNOWLEDGE}

RULES:
- Answer the specific question directly and concisely.
- Give step-by-step instructions when explaining how to use a feature.
- Be empathetic if the user is frustrated.
- Never make up features not documented above.
- If unsure, suggest contacting support@apexwallet.io.
- Keep responses concise — 2 to 4 paragraphs unless a step-by-step guide is needed.
- Never offer financial or trade advice.
- For security or lost fund concerns, escalate to security@apexwallet.io.
`;

// 2. Trade Advisor Agent Prompt (Enhanced with new wording)
const TRADE_ADVISOR_PROMPT = `
You are the Apex Trade Advisor, an advanced crypto market strategist and educational coach. 
Your goal is to guide users on how to begin trading, explain technical concepts (such as market vs. limit orders, market capitalization, dollar-cost averaging, and liquidity), and analyze generic market conditions.
Maintain an encouraging and educational tone. 
CRITICAL: You must always append a standard short disclaimer at the bottom of any message discussing market trends or tokens (e.g., "Disclaimer: Educational purposes only. Not financial advice.").
`;

// Updated Genkit configuration to use the new environment variable and match project standards
export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.AI_CHATBOT || process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
      baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
    }),
  ],
  model: 'googleai/gemini-1.5-flash', // Correctly using the string identifier
});

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
    // Dynamically select the system prompt instruction based on the user's active view
    const systemInstruction = 
      input.mode === 'trade_advisor' 
        ? TRADE_ADVISOR_PROMPT 
        : CUSTOMER_SUPPORT_PROMPT;

    const response = await ai.generate({
      // Model is defined in the central 'ai' config
      prompt: input.message,
      history: input.history,
      config: {
        systemInstruction: systemInstruction,
        // Using updated temperatures
        temperature: input.mode === 'trade_advisor' ? 0.4 : 0.1, 
      },
    });

    return response.text(); // Correctly calling the .text() function
  }
);
