import type { ChangeImpact, ClassChange } from '../../../shared/types.ts';
import { describeRelationship, type ClassKind, type DesignModel } from '../domain/design-model.ts';

const KIND_WORDS: Record<ClassKind, string> = {
  class: 'concrete',
  abstract: 'abstract',
  interface: 'an interface',
  enum: 'an enum',
};

/**
 * Compares two versions of a design. An existing class counts as touched when
 * its members, its kind or its own outgoing relationships changed. New classes
 * that plug into existing ones do not touch them, which is the point of the
 * open-closed principle, and exactly what this measures.
 */
export function diffModels(before: DesignModel, after: DesignModel): ChangeImpact {
  const beforeNames = new Set(before.classes.map((c) => c.name));
  const afterNames = new Set(after.classes.map((c) => c.name));
  const beforeRelations = new Set(before.relationships.map(describeRelationship));
  const afterRelations = new Set(after.relationships.map(describeRelationship));

  const modifiedClasses: ClassChange[] = [];
  for (const previous of before.classes) {
    const next = after.findClass(previous.name);
    if (!next) continue;

    const oldMembers = new Set(previous.members.map((m) => m.signature));
    const newMembers = new Set(next.members.map((m) => m.signature));
    const added = [...newMembers].filter((s) => !oldMembers.has(s));
    const removed = [...oldMembers].filter((s) => !newMembers.has(s));

    if (previous.kind !== next.kind) added.push(`now ${KIND_WORDS[next.kind]}`);
    const outgoing = (model: DesignModel) =>
      new Set(model.relationships.filter((r) => r.from === previous.name).map(describeRelationship));
    const oldOut = outgoing(before);
    const newOut = outgoing(after);
    added.push(...[...newOut].filter((r) => !oldOut.has(r)).map((r) => `new link: ${r}`));
    removed.push(...[...oldOut].filter((r) => !newOut.has(r)).map((r) => `dropped link: ${r}`));

    if (added.length > 0 || removed.length > 0) modifiedClasses.push({ name: previous.name, added, removed });
  }

  const removedClasses = before.classes.filter((c) => !afterNames.has(c.name)).map((c) => c.name);
  const blastRadius = modifiedClasses.length + removedClasses.length;

  return {
    addedClasses: after.classes.filter((c) => !beforeNames.has(c.name)).map((c) => c.name),
    removedClasses,
    modifiedClasses,
    addedRelationships: [...afterRelations].filter((r) => !beforeRelations.has(r)),
    removedRelationships: [...beforeRelations].filter((r) => !afterRelations.has(r)),
    blastRadius,
    // ponytail: bands chosen for designs of 5 to 20 classes.
    label: blastRadius === 0 ? 'additive' : blastRadius <= 2 ? 'localized' : 'wide',
  };
}
