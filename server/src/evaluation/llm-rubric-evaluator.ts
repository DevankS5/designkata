import { z } from 'zod';
import type { CriterionFeedback, CriterionId, Level } from '../../../shared/types.ts';
import { CRITERION_IDS } from '../domain/rubric.ts';
import type { LlmClient } from '../llm/llm-client.ts';
import { generateStructured } from '../llm/structured.ts';
import type { EvaluationContext, Evaluator, EvaluatorResult } from './evaluator.ts';
import { EvidenceVerifier } from './evidence-verifier.ts';
import { buildReviewMessages } from './review-prompt.ts';

// Field order is generation order: the model quotes evidence before it commits to a level.
const Judgment = z.object({
  evidence: z.array(z.string()).max(3),
  strength: z.string(),
  concern: z.string(),
  level: z.number().int().min(1).max(4),
  suggestion: z.string(),
  confidence: z.enum(['low', 'medium', 'high']),
});

const criterionId = z.enum(CRITERION_IDS as [CriterionId, ...CriterionId[]]);

/** Criteria are keyed by id, so the schema itself forces exactly one judgment per criterion. */
export const ReviewAnswer = z.object({
  criteria: z.object({
    requirements: Judgment,
    responsibilities: Judgment,
    coupling: Judgment,
    extensibility: Judgment,
    behaviour: Judgment,
    tradeoffs: Judgment,
  }),
  strengths: z.array(z.string()).max(3),
  summary: z.string(),
  nextFocus: z.object({ criterionId, action: z.string() }),
});
export type ReviewAnswer = z.infer<typeof ReviewAnswer>;

/** Judges a design against the rubric with an LLM, then checks every quote it gives. */
export class LlmRubricEvaluator implements Evaluator {
  readonly name = 'llm-rubric';
  readonly kind = 'judgment' as const;
  private readonly client: LlmClient;
  private readonly verifier: EvidenceVerifier;

  constructor(client: LlmClient, verifier = new EvidenceVerifier()) {
    this.client = client;
    this.verifier = verifier;
  }

  async evaluate(context: EvaluationContext): Promise<EvaluatorResult> {
    const answer = await generateStructured(this.client, buildReviewMessages(context), 'lld_review', ReviewAnswer);

    let verified = 0;
    let total = 0;
    const criteria: CriterionFeedback[] = CRITERION_IDS.map((id) => {
      const judgment = answer.criteria[id];
      const evidence = judgment.evidence
        .map((quote) => clean(quote))
        .filter(Boolean)
        .map((quote) => ({ quote, verified: this.verifier.verify(quote, context.analysis) }));
      total += evidence.length;
      verified += evidence.filter((e) => e.verified).length;

      // A judgment whose every quote is missing from the submission cannot be trusted much.
      const unsupported = evidence.length > 0 && evidence.every((e) => !e.verified);
      return {
        criterionId: id,
        level: judgment.level as Level,
        evidence,
        strength: clean(judgment.strength),
        concern: clean(judgment.concern),
        suggestion: clean(judgment.suggestion),
        confidence: unsupported ? 'low' : judgment.confidence,
      };
    });

    return {
      criteria,
      strengths: answer.strengths.map(clean).filter(Boolean),
      summary: clean(answer.summary),
      nextFocus: { criterionId: answer.nextFocus.criterionId, action: clean(answer.nextFocus.action) },
      evidence: { verified, total },
      reviewer: this.client.model,
    };
  }
}

// Built from code points so this file itself contains no dash characters.
const EM_DASH = new RegExp(`\\s*${String.fromCodePoint(0x2014)}\\s*`, 'g');
const EN_DASH = new RegExp(String.fromCodePoint(0x2013), 'g');

/** Models love em dashes; the product never shows them. */
function clean(text: string): string {
  return text.replace(EM_DASH, ', ').replace(EN_DASH, '-').trim();
}
