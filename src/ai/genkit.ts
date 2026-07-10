
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({
      // The fallback string prevents the plugin from throwing a "Missing API Key" error during build time
      apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || 'BUILD_PLACEHOLDER', 
      baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
    }),
  ],
  // Standardizing on the gemini-1.5-flash model used in our active chat flow
  model: 'googleai/gemini-1.5-flash',
});
