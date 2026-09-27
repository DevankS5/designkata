import type { CoreNoteSection, CriterionId, Finding } from '../../../../shared/types.ts';
import { NOTE_SECTIONS } from '../../../../shared/types.ts';
import type { Rule } from './rule.ts';

// ponytail: 40 characters is a heuristic for "more than a heading". Tune it per problem if needed.
const MIN_SECTION_CHARS = 40;

const SECTIONS: Record<CoreNoteSection, { label: string; criterionId: CriterionId; ask: string }> = {
  requirements: {
    label: 'Requirements and assumptions',
    criterionId: 'requirements',
    ask: 'List what the system must do, what it will not do, and the assumptions you made.',
  },
  entities: {
    label: 'Entities and responsibilities',
    criterionId: 'responsibilities',
    ask: 'Give each main class one line on what it is responsible for.',
  },
  flows: {
    label: 'Key flows',
    criterionId: 'behaviour',
    ask: 'Walk through the main use case step by step, naming the class that does each step.',
  },
  patterns: {
    label: 'Patterns and trade-offs',
    criterionId: 'tradeoffs',
    ask: 'Say which choices you made, what you rejected, and why.',
  },
  edgeCases: {
    label: 'Edge cases',
    criterionId: 'behaviour',
    ask: 'Name the awkward cases (full capacity, concurrent requests, failures) and which class handles each.',
  },
};

export const missingSectionRule: Rule = {
  id: 'missing-section',
  check({ analysis, twist }) {
    const findings: Finding[] = [];
    for (const id of NOTE_SECTIONS) {
      const text = analysis.sections[id] ?? '';
      if (text.length >= MIN_SECTION_CHARS) continue;
      const { label, criterionId, ask } = SECTIONS[id];
      findings.push({
        ruleId: 'missing-section',
        severity: 'warning',
        criterionId,
        message: `"${label}" is ${text ? 'very short' : 'empty'}.`,
        suggestion: ask,
      });
    }
    if (twist && (analysis.sections.changeAnswer ?? '').length < MIN_SECTION_CHARS) {
      findings.push({
        ruleId: 'missing-section',
        severity: 'warning',
        criterionId: 'extensibility',
        message: '"What changed and why" is empty, so the twist cannot be judged fairly.',
        suggestion: 'List the classes you added, the classes you had to edit, and why each edit was needed.',
      });
    }
    return findings;
  },
};

export const diagramSyntaxRule: Rule = {
  id: 'diagram-syntax',
  check({ analysis }) {
    if (!analysis.hasDiagram || analysis.model.isEmpty) {
      return [
        {
          ruleId: 'diagram-syntax',
          severity: 'warning',
          message: 'There is no class diagram, so the structure of the design could not be checked.',
          suggestion: 'Add a Mermaid classDiagram with your main classes and how they relate.',
        },
      ];
    }
    return analysis.diagnostics.map((d) => ({
      ruleId: 'diagram-syntax',
      severity: 'warning' as const,
      message: `Diagram line ${d.line}: ${d.message}`,
      suggestion: 'Fix the syntax so the whole diagram is read. The cheat sheet next to the editor shows every arrow.',
      evidence: `line ${d.line}`,
    }));
  },
};
