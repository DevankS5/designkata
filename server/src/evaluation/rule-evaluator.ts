import type { Finding } from '../../../shared/types.ts';
import type { EvaluationContext, Evaluator, EvaluatorResult } from './evaluator.ts';
import { edgeCaseRule, missingConceptRule } from './rules/coverage-rules.ts';
import {
  deepInheritanceRule,
  dependencyCycleRule,
  orphanClassRule,
  publicStateRule,
} from './rules/coupling-rules.ts';
import { godClassRule, missingAbstractionRule } from './rules/design-rules.ts';
import type { Rule } from './rules/rule.ts';
import { diagramSyntaxRule, missingSectionRule } from './rules/structure-rules.ts';

export const DEFAULT_RULES: readonly Rule[] = [
  diagramSyntaxRule,
  missingSectionRule,
  missingConceptRule,
  godClassRule,
  missingAbstractionRule,
  dependencyCycleRule,
  orphanClassRule,
  publicStateRule,
  deepInheritanceRule,
  edgeCaseRule,
];

/** Runs every rule and returns warnings before notes. Instant, free and repeatable. */
export class RuleBasedEvaluator implements Evaluator {
  readonly name = 'rules';
  readonly kind = 'deterministic' as const;
  private readonly rules: readonly Rule[];

  constructor(rules: readonly Rule[] = DEFAULT_RULES) {
    this.rules = rules;
  }

  check(context: EvaluationContext): Finding[] {
    const findings = this.rules.flatMap((rule) => rule.check(context));
    return [...findings.filter((f) => f.severity === 'warning'), ...findings.filter((f) => f.severity === 'info')];
  }

  async evaluate(context: EvaluationContext): Promise<EvaluatorResult> {
    return { findings: this.check(context) };
  }
}
