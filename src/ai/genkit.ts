import {genkit, Plugin} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

let googleAiPlugin: Plugin<any> | undefined = undefined;
if (process.env.GEMINI_API_KEY) {
  googleAiPlugin = googleAI({
    apiKey: process.env.GEMINI_API_KEY,
  });
}

export const ai = genkit({
  plugins: [googleAiPlugin].filter((p): p is Plugin<any> => !!p),
});
