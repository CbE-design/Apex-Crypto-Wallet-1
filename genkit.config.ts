
import {googleAI} from '@genkit-ai/googleai';
import {configureGenkit} from 'genkit';

export default configureGenkit({
  plugins: [
    googleAI({
      apiKey: process.env.GEMINI_API_KEY,
    }),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
