import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

const ai = genkit({
  plugins: [
    googleAI({apiKey: process.env.GEMINI_API_KEY}),
  ],
  enableTracingAndMetrics: false,
});

export { ai };
