// Does the reviewer rank designs the way an expert would, and does it hold still?
// Reviews a weak, a medium and a strong Parking Lot design RUNS times each and
// reports mean levels, ordering violations and the spread across runs.
// Usage: npm run calibrate
import type { SubmissionContent } from '../../shared/types.ts';
import { RUBRIC } from '../../shared/rubric.ts';
import { SubmissionAnalyzer } from '../src/analysis/submission-analyzer.ts';
import { loadConfig } from '../src/config.ts';
import type { EvaluationContext } from '../src/evaluation/evaluator.ts';
import { LlmRubricEvaluator } from '../src/evaluation/llm-rubric-evaluator.ts';
import { RuleBasedEvaluator } from '../src/evaluation/rule-evaluator.ts';
import { OpenRouterClient } from '../src/llm/openrouter-client.ts';
import { parkingLot } from '../src/problems/parking-lot.ts';
import { medium, strong, weak } from './fixtures/parking-lot-designs.ts';

const RUNS = Number(process.env.RUNS ?? 3);
const { llm } = loadConfig();
if (!llm) throw new Error('Set OPENROUTER_API_KEY to run the calibration.');

const evaluator = new LlmRubricEvaluator(new OpenRouterClient(llm));
const analyzer = new SubmissionAnalyzer();
const designs: [string, SubmissionContent][] = [
  ['weak', weak],
  ['medium', medium],
  ['strong', strong],
];

type Levels = Record<string, number[]>;
const results: Record<string, Levels> = {};
let verified = 0;
let total = 0;

for (const [name, content] of designs) {
  const context: EvaluationContext = { problem: parkingLot, analysis: analyzer.analyze(content), findings: [] };
  context.findings = new RuleBasedEvaluator().check(context);
  results[name] = Object.fromEntries(RUBRIC.map((c) => [c.id, []]));
  for (let run = 0; run < RUNS; run += 1) {
    const result = await evaluator.evaluate(context);
    for (const c of result.criteria ?? []) results[name]![c.criterionId]!.push(c.level);
    verified += result.evidence?.verified ?? 0;
    total += result.evidence?.total ?? 0;
  }
}

const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;
const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
const fmt = (n: number) => n.toFixed(1);

console.log(`Model ${llm.model}, ${RUNS} runs per design, Parking Lot.\n`);
console.log(`${'criterion'.padEnd(18)} ${'weak'.padStart(6)} ${'medium'.padStart(7)} ${'strong'.padStart(7)}   max spread`);
let violations = 0;
let widest = 0;
for (const criterion of RUBRIC) {
  const [w, m, s] = designs.map(([name]) => results[name]![criterion.id]!);
  const means = [mean(w!), mean(m!), mean(s!)];
  if (!(means[0]! <= means[1]! && means[1]! <= means[2]!)) violations += 1;
  const maxSpread = Math.max(spread(w!), spread(m!), spread(s!));
  widest = Math.max(widest, maxSpread);
  console.log(`${criterion.id.padEnd(18)} ${fmt(means[0]!).padStart(6)} ${fmt(means[1]!).padStart(7)} ${fmt(means[2]!).padStart(7)}   ${maxSpread}`);
}
const overall = designs.map(([name]) => fmt(mean(Object.values(results[name]!).flat())));
console.log(`${'all criteria'.padEnd(18)} ${overall[0]!.padStart(6)} ${overall[1]!.padStart(7)} ${overall[2]!.padStart(7)}`);
console.log(`\nOrdering weak <= medium <= strong held on ${RUBRIC.length - violations} of ${RUBRIC.length} criteria.`);
console.log(`Widest spread for one criterion across runs: ${widest} level(s).`);
console.log(`Quotes found word for word: ${verified} of ${total}.`);
