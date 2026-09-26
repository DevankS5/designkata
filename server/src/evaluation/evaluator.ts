import type {
  ChangeImpact,
  CriterionFeedback,
  CriterionId,
  Finding,
} from '../../../shared/types.ts';
import type { AnalyzedSubmission } from '../analysis/submission-analyzer.ts';
import type { Problem, Twist } from '../domain/problem.ts';

export interface EvaluationContext {
  problem: Problem;
  analysis: AnalyzedSubmission;
  /** Present when the learner is answering the problem's twist. */
  twist?: Twist;
  /** Present when there is an earlier version to compare with. */
  changeImpact?: ChangeImpact;
  /** Findings from evaluators that already ran, so later ones can build on them. */
  findings: Finding[];
}

export interface EvaluatorResult {
  findings?: Finding[];
  criteria?: CriterionFeedback[];
  strengths?: string[];
  summary?: string;
  nextFocus?: { criterionId: CriterionId; action: string };
  evidence?: { verified: number; total: number };
  /** Who judged: a model id for an LLM, a name for a human reviewer. */
  reviewer?: string;
}

/**
 * One way of judging a design. Deterministic evaluators are instant and free
 * and always run first. Judgment evaluators (an LLM today, a human reviewer
 * later) may be slow or fail, and never block the deterministic feedback.
 */
export interface Evaluator {
  readonly name: string;
  readonly kind: 'deterministic' | 'judgment';
  evaluate(context: EvaluationContext): Promise<EvaluatorResult>;
}
