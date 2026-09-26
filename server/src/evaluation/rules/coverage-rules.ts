import type { Finding } from '../../../../shared/types.ts';
import { nameMatches, textMentions } from './matching.ts';
import type { Rule } from './rule.ts';

/**
 * Checks that the core concepts of the problem show up as classes.
 * A concept that is only discussed in the notes is a softer signal than one that is missing entirely.
 */
export const missingConceptRule: Rule = {
  id: 'missing-concept',
  check({ problem, analysis }) {
    if (analysis.model.isEmpty) return [];
    const notes = Object.values(analysis.sections).join('\n');
    const findings: Finding[] = [];

    for (const concept of problem.concepts) {
      if (analysis.model.classes.some((c) => nameMatches(c.name, concept.synonyms))) continue;
      const discussed = textMentions(notes, concept.synonyms);
      findings.push({
        ruleId: 'missing-concept',
        severity: discussed ? 'info' : 'warning',
        criterionId: 'requirements',
        message: discussed
          ? `${concept.name} is discussed in your notes but has no class in the diagram.`
          : `No class looks like ${concept.name} (for example ${concept.synonyms.slice(0, 3).join(', ')}).`,
        suggestion: `Model ${concept.name} as a class, or say in your notes why the design does not need it.`,
      });
    }
    return findings;
  },
};
