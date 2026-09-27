import type { Finding } from '../../../../shared/types.ts';
import type { EvaluationContext } from '../evaluator.ts';

/** One deterministic check. It returns signals that point at evidence, never a grade. */
export interface Rule {
  readonly id: string;
  check(context: EvaluationContext): Finding[];
}
