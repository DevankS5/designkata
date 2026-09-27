import { describe, expect, it } from 'vitest';
import type { CriterionFeedback, FeedbackReport, Finding } from '../../../shared/types.ts';
import type { EvaluationContext, Evaluator, EvaluatorResult } from '../../src/evaluation/evaluator.ts';
import { chooseNextFocus } from '../../src/evaluation/feedback-composer.ts';
import { EvaluationFailure, EvaluationPipeline } from '../../src/evaluation/pipeline.ts';
import { COMPLETE_LOT, contextFor } from '../helpers.ts';

const warning: Finding = {
  ruleId: 'god-class',
  severity: 'warning',
  criterionId: 'responsibilities',
  message: 'ParkingLot does too much.',
  suggestion: 'Split ParkingLot.',
};

const rules: Evaluator = { name: 'rules', kind: 'deterministic', evaluate: async () => ({ findings: [warning] }) };

function reviewer(result: EvaluatorResult | Error, seen: EvaluationContext[] = []): Evaluator {
  return {
    name: 'llm-rubric',
    kind: 'judgment',
    evaluate: async (context) => {
      seen.push(context);
      if (result instanceof Error) throw result;
      return result;
    },
  };
}

const criterion = (criterionId: CriterionFeedback['criterionId'], level: CriterionFeedback['level']): CriterionFeedback => ({
  criterionId,
  level,
  evidence: [],
  strength: '',
  concern: '',
  suggestion: `Improve ${criterionId}.`,
  confidence: 'high',
});

function ticking(): () => number {
  let time = 0;
  return () => (time += 5);
}

describe('EvaluationPipeline', () => {
  it('reports rules-only feedback when no reviewer is configured', async () => {
    const partials: FeedbackReport[] = [];
    const report = await new EvaluationPipeline([rules]).run(contextFor({ diagram: COMPLETE_LOT }), async (p) => void partials.push(p));

    expect(report.ai).toEqual({ state: 'not-configured' });
    expect(report.findings).toEqual([warning]);
    expect(report.nextFocus).toEqual({ criterionId: 'responsibilities', action: 'Split ParkingLot.' });
    expect(partials).toEqual([]);
  });

  it('shares the rule findings early, then hands them to the reviewer', async () => {
    const partials: FeedbackReport[] = [];
    const seen: EvaluationContext[] = [];
    const pipeline = new EvaluationPipeline(
      [reviewer({ criteria: [criterion('coupling', 2)], reviewer: 'test/model', evidence: { verified: 2, total: 3 } }, seen), rules],
      ticking(),
    );

    const report = await pipeline.run(contextFor({ diagram: COMPLETE_LOT }), async (p) => void partials.push(p));

    expect(partials).toHaveLength(1);
    expect(partials[0]!.ai.state).toBe('pending');
    expect(partials[0]!.findings).toEqual([warning]);
    expect(seen[0]!.findings).toEqual([warning]);
    expect(report.ai).toEqual({ state: 'completed', model: 'test/model' });
    expect(report.evidence).toEqual({ verified: 2, total: 3 });
    expect(report.runs).toEqual([
      { evaluator: 'rules', status: 'completed', durationMs: 5 },
      { evaluator: 'llm-rubric', status: 'completed', durationMs: 5 },
    ]);
  });

  it('keeps the rule findings when the reviewer fails', async () => {
    const pipeline = new EvaluationPipeline([rules, reviewer(new Error('AI reviewer timed out'))], ticking());
    const failure = await pipeline.run(contextFor({ diagram: COMPLETE_LOT })).catch((e: unknown) => e);

    expect(failure).toBeInstanceOf(EvaluationFailure);
    const { partial, message } = failure as EvaluationFailure;
    expect(message).toBe('AI reviewer timed out');
    expect(partial.ai.state).toBe('failed');
    expect(partial.findings).toEqual([warning]);
    expect(partial.runs[1]).toMatchObject({ evaluator: 'llm-rubric', status: 'failed', error: 'AI reviewer timed out' });
  });

  it('passes the measured change impact through to the report', async () => {
    const context = contextFor({ diagram: COMPLETE_LOT });
    context.changeImpact = {
      addedClasses: ['EVSpot'],
      removedClasses: [],
      modifiedClasses: [],
      addedRelationships: [],
      removedRelationships: [],
      blastRadius: 0,
      label: 'additive',
    };
    const report = await new EvaluationPipeline([rules]).run(context);
    expect(report.changeImpact?.label).toBe('additive');
  });
});

describe('chooseNextFocus', () => {
  const criteria = [criterion('requirements', 3), criterion('coupling', 2), criterion('behaviour', 2), criterion('tradeoffs', 4)];

  it("keeps the reviewer's pick when that criterion has room to improve", () => {
    expect(chooseNextFocus({ criterionId: 'requirements', action: 'State assumptions.' }, criteria, [])).toEqual({
      criterionId: 'requirements',
      action: 'State assumptions.',
    });
  });

  it('overrides a pick that is already at level 4, taking the weakest criterion in rubric order', () => {
    expect(chooseNextFocus({ criterionId: 'tradeoffs', action: 'Polish.' }, criteria, [])).toEqual({
      criterionId: 'coupling',
      action: 'Improve coupling.',
    });
  });

  it('has nothing to suggest when every criterion is at level 4', () => {
    expect(chooseNextFocus(undefined, [criterion('coupling', 4)], [])).toBeUndefined();
  });
});
