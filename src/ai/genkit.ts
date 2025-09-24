
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import nextJS from '@genkit-ai/next';

export * from './flows/crypto-news-summary';

export const ai = genkit({
  plugins: [
    nextJS(),
    googleAI({
      apiKey: process.env.GEMINI_API_KEY,
    }),
  ],
});
