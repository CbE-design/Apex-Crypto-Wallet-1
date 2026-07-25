import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const googleai = googleAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || 'BUILD_PLACEHOLDER',
});

export const ai = genkit({
  plugins: [googleai],
});

export const gemini15Flash = googleai.model('gemini-1.5-flash');
