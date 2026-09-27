import type { Finding } from '../../../../shared/types.ts';
import type { DesignModel } from '../../domain/design-model.ts';
import type { Rule } from './rule.ts';

// ponytail: deeper than three levels of inheritance is a heuristic for "reach for composition".
const MAX_INHERITANCE_DEPTH = 3;
const MIN_CLASSES_FOR_ORPHANS = 4;

export const dependencyCycleRule: Rule = {
  id: 'dependency-cycle',
  check({ analysis }) {
    return analysis.model.dependencyCycles().map((group) =>
      group.length === 2
        ? {
            ruleId: 'dependency-cycle',
            severity: 'info' as const,
            criterionId: 'coupling' as const,
            evidence: group.join(', '),
            message: `${group[0]} and ${group[1]} depend on each other.`,
            suggestion: 'Decide which one owns the relationship, or put an interface between them so the dependency points one way.',
          }
        : {
            ruleId: 'dependency-cycle',
            severity: 'warning' as const,
            criterionId: 'coupling' as const,
            evidence: group.join(', '),
            message: `${listWords(group)} depend on each other in a loop.`,
            suggestion: 'Break the loop: one of them should depend on an abstraction instead of the next class.',
          },
    );
  },
};

/** A class nobody uses and that uses nobody, not even as a field type, is usually leftover or misplaced. */
export const orphanClassRule: Rule = {
  id: 'orphan-class',
  check({ analysis }) {
    const { model } = analysis;
    if (model.classes.length < MIN_CLASSES_FOR_ORPHANS) return [];
    return model.classes
      .filter((c) => c.kind !== 'enum' && model.relationshipsOf(c.name).length === 0 && !mentionedByOthers(model, c.name))
      .map((c) => ({
        ruleId: 'orphan-class',
        severity: 'info' as const,
        criterionId: 'responsibilities' as const,
        evidence: c.name,
        message: `${c.name} is not connected to any other class.`,
        suggestion: `Connect ${c.name} where it is used, or remove it if nothing needs it.`,
      }));
  },
};

export const publicStateRule: Rule = {
  id: 'public-state',
  check({ analysis }) {
    const { model } = analysis;
    const exposing = model.classes
      .filter((c) => c.kind === 'class' || c.kind === 'abstract')
      .map((c) => ({ name: c.name, fields: model.attributesOf(c.name).filter((m) => m.visibility === '+').map((m) => m.name) }))
      .filter((c) => c.fields.length > 0);
    if (exposing.length === 0) return [];

    const detail = exposing.map((c) => `${c.name} (${c.fields.join(', ')})`).join('; ');
    return [
      {
        ruleId: 'public-state',
        severity: 'info',
        criterionId: 'coupling',
        evidence: exposing.map((c) => c.name).join(', '),
        message: `${exposing.length === 1 ? 'One class exposes' : `${exposing.length} classes expose`} public fields: ${detail}.`,
        suggestion: 'Make fields private and change state through methods (occupy(), release()), so each class can protect its own rules.',
      },
    ];
  },
};

export const deepInheritanceRule: Rule = {
  id: 'deep-inheritance',
  check({ analysis }) {
    const { model } = analysis;
    return model.classes
      .filter((c) => model.inheritanceDepth(c.name) > MAX_INHERITANCE_DEPTH)
      .map((c) => ({
        ruleId: 'deep-inheritance',
        severity: 'warning' as const,
        criterionId: 'extensibility' as const,
        evidence: c.name,
        message: `${c.name} sits ${model.inheritanceDepth(c.name)} levels deep in an inheritance chain.`,
        suggestion: 'Prefer composition: move the part that varies into a strategy object instead of adding another subclass.',
      }));
  },
};

function mentionedByOthers(model: DesignModel, name: string): boolean {
  const word = new RegExp(`\\b${name}\\b`);
  return model.classes.some((c) => c.name !== name && c.members.some((m) => word.test(m.signature)));
}

function listWords(items: string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}
