import { genkit } from 'genkit';
import { googleAI, gemini15Flash } from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || 'BUILD_PLACEHOLDER',
    }),
  ],
});

export { gemini15Flash };
