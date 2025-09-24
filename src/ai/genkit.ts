import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import nextJS from '@genkit-ai/next';

const ai = genkit({
  plugins: [
    nextJS(),
    googleAI(),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});

export { ai };
