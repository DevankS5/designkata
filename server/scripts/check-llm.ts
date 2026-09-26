// Checks that the configured OpenRouter key and model work with strict JSON output.
// Usage: npm run check:llm
import { z } from 'zod';
import { loadConfig } from '../src/config.ts';
import { OpenRouterClient } from '../src/llm/openrouter-client.ts';
import { generateStructured } from '../src/llm/structured.ts';

const { llm } = loadConfig();
if (!llm) {
  console.log('OPENROUTER_API_KEY is not set. AI review is off; rules-only feedback still works.');
  process.exit(0);
}

const client = new OpenRouterClient({ apiKey: llm.apiKey, model: llm.model, reasoning: llm.reasoning });
const started = Date.now();
const answer = await generateStructured(
  client,
  [
    {
      role: 'user',
      content: 'A parking lot charges hourly today and will add weekend and event pricing. Which design pattern fits, and how well (1 to 4)?',
    },
  ],
  'pattern_check',
  z.object({ pattern: z.string(), fit: z.number().int().min(1).max(4), why: z.string() }),
);
console.log(`OK: ${llm.model} (reasoning ${llm.reasoning}) answered in ${Date.now() - started} ms`);
console.log(answer);
