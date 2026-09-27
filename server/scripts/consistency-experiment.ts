// How consistent is LLM feedback on the same design?
// Asks about the Parking Lot sample design RUNS times in three ways:
//   A. "Rate this design from 1 to 10" at the model's default temperature, like a chat app
//   B. the same naive question at temperature 0
//   C. DesignKata's rubric review (temperature 0, anchored levels, quoted evidence)
// Usage: npm run experiment:consistency
import { z } from 'zod';
import { SubmissionAnalyzer } from '../src/analysis/submission-analyzer.ts';
import { loadConfig } from '../src/config.ts';
import { RUBRIC } from '../../shared/rubric.ts';
import type { EvaluationContext } from '../src/evaluation/evaluator.ts';
import { LlmRubricEvaluator } from '../src/evaluation/llm-rubric-evaluator.ts';
import { RuleBasedEvaluator } from '../src/evaluation/rule-evaluator.ts';
import type { LlmClient, LlmRequest } from '../src/llm/llm-client.ts';
import { OpenRouterClient } from '../src/llm/openrouter-client.ts';
import { generateStructured } from '../src/llm/structured.ts';
import { parkingLot } from '../src/problems/parking-lot.ts';

const RUNS = Number(process.env.RUNS ?? 5);
const { llm } = loadConfig();
if (!llm) throw new Error('Set OPENROUTER_API_KEY to run the experiment.');

const sample = parkingLot.sample!;
const analysis = new SubmissionAnalyzer().analyze(sample);
const designText = analysis.artifacts.map((a) => a.text).join('\n\n');

/** Same client, but with the chat-app default temperature instead of 0. */
class DefaultTemperatureClient implements LlmClient {
  readonly model: string;
  private readonly inner: OpenRouterClient;
  constructor(inner: OpenRouterClient) {
    this.inner = inner;
    this.model = inner.model;
  }
  complete(request: LlmRequest): Promise<string> {
    return this.inner.complete({ ...request, temperature: 1 });
  }
}

const zeroTemperature = new OpenRouterClient({ apiKey: llm.apiKey, model: llm.model, reasoning: llm.reasoning });
const naiveQuestion = [
  {
    role: 'user' as const,
    content: `Here is my low-level design for a parking lot system. Rate it from 1 to 10 and explain briefly.\n\n${designText}`,
  },
];
const NaiveAnswer = z.object({ score: z.number().int().min(1).max(10), reason: z.string() });

async function naive(client: LlmClient): Promise<number[]> {
  const scores: number[] = [];
  for (let i = 0; i < RUNS; i += 1) {
    const answer = await generateStructured(client, naiveQuestion, 'rating', NaiveAnswer);
    scores.push(answer.score);
  }
  return scores;
}

async function rubric(): Promise<{ levels: Record<string, number[]>; verified: number; total: number }> {
  const context: EvaluationContext = { problem: parkingLot, analysis, findings: [] };
  context.findings = new RuleBasedEvaluator().check(context);
  const evaluator = new LlmRubricEvaluator(zeroTemperature);
  const levels: Record<string, number[]> = Object.fromEntries(RUBRIC.map((c) => [c.id, []]));
  let verified = 0;
  let total = 0;
  for (let i = 0; i < RUNS; i += 1) {
    const result = await evaluator.evaluate(context);
    for (const c of result.criteria ?? []) levels[c.criterionId]!.push(c.level);
    verified += result.evidence?.verified ?? 0;
    total += result.evidence?.total ?? 0;
  }
  return { levels, verified, total };
}

const spread = (values: number[]) => Math.max(...values) - Math.min(...values);

console.log(`Model ${llm.model}, ${RUNS} runs each, on the Parking Lot sample design.\n`);
const a = await naive(new DefaultTemperatureClient(zeroTemperature));
console.log(`A. Naive "rate 1-10", default temperature: [${a.join(', ')}]  spread ${spread(a)}`);
const b = await naive(zeroTemperature);
console.log(`B. Naive "rate 1-10", temperature 0:       [${b.join(', ')}]  spread ${spread(b)}`);
const c = await rubric();
console.log('C. DesignKata rubric, temperature 0 (level 1-4 per criterion):');
for (const [id, values] of Object.entries(c.levels)) console.log(`   ${id.padEnd(17)} [${values.join(', ')}]  spread ${spread(values)}`);
console.log(`   quotes found in the submission: ${c.verified} of ${c.total}`);
