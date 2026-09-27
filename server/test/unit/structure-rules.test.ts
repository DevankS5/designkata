import { describe, expect, it } from 'vitest';
import { RuleBasedEvaluator } from '../../src/evaluation/rule-evaluator.ts';
import { diagramSyntaxRule, missingSectionRule } from '../../src/evaluation/rules/structure-rules.ts';
import type { Rule } from '../../src/evaluation/rules/rule.ts';
import { FULL_NOTES, contextFor } from '../helpers.ts';

const DIAGRAM = 'classDiagram\n  ParkingLot *-- Level';

describe('missing-section rule', () => {
  it('asks for every section that is empty or too short', () => {
    const findings = missingSectionRule.check(contextFor({ notes: { requirements: 'Park cars.' }, diagram: DIAGRAM }));

    expect(findings.map((f) => f.message)).toEqual([
      '"Requirements and assumptions" is very short.',
      '"Entities and responsibilities" is empty.',
      '"Key flows" is empty.',
      '"Patterns and trade-offs" is empty.',
      '"Edge cases" is empty.',
    ]);
    expect(findings[0]!.criterionId).toBe('requirements');
  });

  it('stays quiet when every section has content', () => {
    expect(missingSectionRule.check(contextFor({ diagram: DIAGRAM }))).toEqual([]);
  });

  it('asks what changed when the learner is answering the twist', () => {
    const findings = missingSectionRule.check(contextFor({ diagram: DIAGRAM, withTwist: true }));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.criterionId).toBe('extensibility');

    const answered = missingSectionRule.check(
      contextFor({
        diagram: DIAGRAM,
        withTwist: true,
        notes: { ...FULL_NOTES, changeAnswer: 'Added EVSpot and KwhPricing. Edited nothing else because pricing is a strategy.' },
      }),
    );
    expect(answered).toEqual([]);
  });
});

describe('diagram-syntax rule', () => {
  it('says so when there is no diagram at all', () => {
    const findings = diagramSyntaxRule.check(contextFor({}));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain('no class diagram');
  });

  it('turns each reader diagnostic into a finding with its line', () => {
    const findings = diagramSyntaxRule.check(contextFor({ diagram: 'classDiagram\n  Lot *-- Level\n  Gate ==> Lot' }));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.evidence).toBe('line 3');
  });

  it('is quiet for a clean diagram', () => {
    expect(diagramSyntaxRule.check(contextFor({ diagram: DIAGRAM }))).toEqual([]);
  });
});

describe('RuleBasedEvaluator', () => {
  it('lists warnings before notes, whatever order the rules run in', async () => {
    const info: Rule = { id: 'a', check: () => [{ ruleId: 'a', severity: 'info', message: 'note', suggestion: '' }] };
    const warning: Rule = { id: 'b', check: () => [{ ruleId: 'b', severity: 'warning', message: 'warn', suggestion: '' }] };

    const result = await new RuleBasedEvaluator([info, warning]).evaluate(contextFor({ diagram: DIAGRAM }));
    expect(result.findings!.map((f) => f.ruleId)).toEqual(['b', 'a']);
  });
});
