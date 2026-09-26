import type { Finding } from '../../../../shared/types.ts';
import { nameMatches } from './matching.ts';
import type { Rule } from './rule.ts';

// ponytail: fixed thresholds for "doing too much". They are signals for the
// learner and the reviewer to look at, not verdicts.
const MAX_METHODS = 8;
const MAX_MEMBERS = 14;
const MAX_NEIGHBOURS = 6;

export const godClassRule: Rule = {
  id: 'god-class',
  check({ analysis }) {
    const { model } = analysis;
    const findings: Finding[] = [];
    for (const node of model.classes) {
      if (node.kind === 'enum') continue;
      const methods = model.methodsOf(node.name).length;
      const neighbours = new Set(model.relationshipsOf(node.name).map((r) => (r.from === node.name ? r.to : r.from)));
      neighbours.delete(node.name);
      const reasons = [
        methods > MAX_METHODS ? `${methods} methods` : '',
        node.members.length > MAX_MEMBERS && methods <= MAX_METHODS ? `${node.members.length} members` : '',
        neighbours.size > MAX_NEIGHBOURS ? `relationships with ${neighbours.size} classes` : '',
      ].filter(Boolean);
      if (reasons.length === 0) continue;

      findings.push({
        ruleId: 'god-class',
        severity: 'warning',
        criterionId: 'responsibilities',
        evidence: node.name,
        message: `${node.name} has ${reasons.join(' and ')}. It probably owns more than one responsibility.`,
        suggestion: `Split ${node.name} by reason to change, and let it coordinate instead of doing every job itself.`,
      });
    }
    return findings;
  },
};

/**
 * Each variation point of the problem should sit behind an interface or an abstract class.
 * A concrete class for it is a softer signal: it is isolated, but new variants still mean editing it.
 */
export const missingAbstractionRule: Rule = {
  id: 'missing-abstraction',
  check({ problem, analysis }) {
    const { model } = analysis;
    if (model.isEmpty) return [];
    const abstractions = model.classes.filter((c) => c.kind === 'interface' || c.kind === 'abstract');
    const findings: Finding[] = [];

    for (const point of problem.variationPoints) {
      const abstracted = abstractions.some(
        (a) => nameMatches(a.name, point.synonyms) || model.subtypesOf(a.name).some((s) => nameMatches(s, point.synonyms)),
      );
      if (abstracted) continue;

      const concrete = model.classes.find((c) => nameMatches(c.name, point.synonyms));
      findings.push(
        concrete
          ? {
              ruleId: 'missing-abstraction',
              severity: 'info',
              criterionId: 'extensibility',
              evidence: concrete.name,
              message: `${point.name} has its own class (${concrete.name}), but it is concrete, so each new variant means editing it.`,
              suggestion: point.suggestion,
            }
          : {
              ruleId: 'missing-abstraction',
              severity: 'warning',
              criterionId: 'extensibility',
              message: `${point.name} varies (${lowerFirst(point.why)}) but nothing in the diagram abstracts it.`,
              suggestion: point.suggestion,
            },
      );
    }
    return findings;
  },
};

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1).replace(/\.$/, '');
}
