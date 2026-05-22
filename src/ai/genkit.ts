import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
      baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
    }),
  ],
  model: 'googleai/gemini-2.5-flash',
});
