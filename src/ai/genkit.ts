import { configureGenkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { ai } from '@genkit-ai/ai';

configureGenkit({
  plugins: [
    googleAI(),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});

export { ai };
