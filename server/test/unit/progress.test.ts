import { describe, expect, it } from 'vitest';
import type { CriterionFeedback, FeedbackReport, Finding, Level } from '../../../shared/types.ts';
import { recurringFindings, recurringWeaknesses } from '../../src/app/progress.ts';

function report(levels: Partial<Record<CriterionFeedback['criterionId'], Level>>, findings: Finding[] = []): FeedbackReport {
  return {
    findings,
    criteria: Object.entries(levels).map(([criterionId, level]) => ({
      criterionId: criterionId as CriterionFeedback['criterionId'],
      level: level!,
      evidence: [],
      strength: '',
      concern: '',
      suggestion: '',
      confidence: 'high',
    })),
    strengths: [],
    evidence: { verified: 0, total: 0 },
    ai: { state: 'completed' },
    runs: [],
  };
}

const godClass: Finding = { ruleId: 'god-class', severity: 'warning', message: 'ParkingLot has 11 methods.', suggestion: '' };

describe('recurringWeaknesses', () => {
  it('names criteria that were low in at least two recent reviews, worst first', () => {
    const weaknesses = recurringWeaknesses([
      report({ coupling: 1, extensibility: 2, tradeoffs: 3 }),
      report({ coupling: 2, extensibility: 3, tradeoffs: 2 }),
      report({ coupling: 2, extensibility: 2, tradeoffs: 4 }),
    ]);

    expect(weaknesses).toEqual([
      { criterionId: 'coupling', lowCount: 3, outOf: 3, averageLevel: 1.7 },
      { criterionId: 'extensibility', lowCount: 2, outOf: 3, averageLevel: 2.3 },
    ]);
  });

  it('needs at least two reviews, and only looks at the recent ones', () => {
    expect(recurringWeaknesses([report({ coupling: 1 })])).toEqual([]);
    const old = Array.from({ length: 5 }, () => report({ coupling: 1 }));
    const recent = Array.from({ length: 5 }, () => report({ coupling: 4 }));
    expect(recurringWeaknesses([...old, ...recent])).toEqual([]);
  });

  it('ignores rules-only reports, which have no levels', () => {
    expect(recurringWeaknesses([report({}), report({}), report({ coupling: 1 })])).toEqual([]);
  });
});

describe('recurringFindings', () => {
  it('counts a warning once per review and reports the ones that come back', () => {
    const findings = recurringFindings([report({}, [godClass, godClass]), report({}), report({}, [godClass])]);
    expect(findings).toEqual([{ ruleId: 'god-class', count: 2, outOf: 3, example: 'ParkingLot has 11 methods.' }]);
  });
});
