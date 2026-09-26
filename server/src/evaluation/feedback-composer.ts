import type {
  ChangeImpact,
  CriterionFeedback,
  EvaluatorRun,
  FeedbackReport,
  Finding,
} from '../../../shared/types.ts';
import { CRITERION_IDS } from '../domain/rubric.ts';
import type { EvaluatorResult } from './evaluator.ts';

/** Merges what every evaluator said into the one report the learner reads. */
export function composeReport(
  results: readonly EvaluatorResult[],
  runs: readonly EvaluatorRun[],
  ai: FeedbackReport['ai'],
  changeImpact?: ChangeImpact,
): FeedbackReport {
  const findings = results.flatMap((r) => r.findings ?? []);
  const criteria = results.flatMap((r) => r.criteria ?? []);
  const summary = results.map((r) => r.summary).find(Boolean);
  const nextFocus = chooseNextFocus(results.map((r) => r.nextFocus).find(Boolean), criteria, findings);

  return {
    findings,
    criteria,
    strengths: results.flatMap((r) => r.strengths ?? []).slice(0, 3),
    ...(summary ? { summary } : {}),
    ...(nextFocus ? { nextFocus } : {}),
    ...(changeImpact ? { changeImpact } : {}),
    evidence: results.reduce(
      (sum, r) => ({ verified: sum.verified + (r.evidence?.verified ?? 0), total: sum.total + (r.evidence?.total ?? 0) }),
      { verified: 0, total: 0 },
    ),
    ai,
    runs: [...runs],
  };
}

/**
 * One thing to work on next. The reviewer's pick is kept when it names a
 * criterion that actually has room to improve; otherwise the lowest level wins,
 * with rubric order breaking ties. Without a review, the first warning decides.
 */
export function chooseNextFocus(
  proposed: FeedbackReport['nextFocus'],
  criteria: readonly CriterionFeedback[],
  findings: readonly Finding[],
): FeedbackReport['nextFocus'] {
  if (criteria.length > 0) {
    const judged = criteria.find((c) => c.criterionId === proposed?.criterionId);
    if (proposed && judged && judged.level < 4) return proposed;

    const weakest = [...criteria].sort(
      (a, b) => a.level - b.level || CRITERION_IDS.indexOf(a.criterionId) - CRITERION_IDS.indexOf(b.criterionId),
    )[0]!;
    return weakest.level < 4 ? { criterionId: weakest.criterionId, action: weakest.suggestion } : undefined;
  }

  const warning = findings.find((f) => f.severity === 'warning' && f.criterionId);
  return warning ? { criterionId: warning.criterionId!, action: warning.suggestion } : undefined;
}
