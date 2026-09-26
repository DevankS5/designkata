import type { EvaluatorRun, FeedbackReport } from '../../../shared/types.ts';
import type { EvaluationContext, Evaluator, EvaluatorResult } from './evaluator.ts';
import { composeReport } from './feedback-composer.ts';

/** A judgment evaluator gave up. Carries everything that was learned before it did. */
export class EvaluationFailure extends Error {
  readonly partial: FeedbackReport;

  constructor(message: string, partial: FeedbackReport) {
    super(message);
    this.name = 'EvaluationFailure';
    this.partial = partial;
  }
}

/**
 * Runs deterministic evaluators first and reports their findings straight
 * away, then hands those findings to the judgment evaluators. The practice
 * flow only knows this class, so adding a reviewer never touches it.
 */
export class EvaluationPipeline {
  private readonly deterministic: readonly Evaluator[];
  private readonly judgment: readonly Evaluator[];
  private readonly now: () => number;

  constructor(evaluators: readonly Evaluator[], now: () => number = Date.now) {
    this.deterministic = evaluators.filter((e) => e.kind === 'deterministic');
    this.judgment = evaluators.filter((e) => e.kind === 'judgment');
    this.now = now;
  }

  async run(context: EvaluationContext, onPartial?: (report: FeedbackReport) => Promise<void>): Promise<FeedbackReport> {
    const results: EvaluatorResult[] = [];
    const runs: EvaluatorRun[] = [];
    const report = (ai: FeedbackReport['ai']) => composeReport(results, runs, ai, context.changeImpact);

    for (const evaluator of this.deterministic) results.push(await this.timed(evaluator, context, runs));
    if (this.judgment.length === 0) return report({ state: 'not-configured' });

    await onPartial?.(report({ state: 'pending' }));
    const withFindings: EvaluationContext = { ...context, findings: results.flatMap((r) => r.findings ?? []) };
    for (const evaluator of this.judgment) {
      try {
        results.push(await this.timed(evaluator, withFindings, runs));
      } catch (error) {
        throw new EvaluationFailure(errorMessage(error), report({ state: 'failed' }));
      }
    }

    const reviewer = results.map((r) => r.reviewer).find(Boolean);
    return report({ state: 'completed', ...(reviewer ? { model: reviewer } : {}) });
  }

  private async timed(evaluator: Evaluator, context: EvaluationContext, runs: EvaluatorRun[]): Promise<EvaluatorResult> {
    const started = this.now();
    try {
      const result = await evaluator.evaluate(context);
      runs.push({ evaluator: evaluator.name, status: 'completed', durationMs: this.now() - started });
      return result;
    } catch (error) {
      runs.push({ evaluator: evaluator.name, status: 'failed', durationMs: this.now() - started, error: errorMessage(error) });
      throw error;
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
