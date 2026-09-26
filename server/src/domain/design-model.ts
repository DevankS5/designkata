// The normalized picture of a learner's design. Every evaluator reads this,
// never the raw input, so a new input format only needs a new reader.

export type ClassKind = 'class' | 'interface' | 'abstract' | 'enum';

export type RelationKind =
  | 'inheritance'
  | 'realization'
  | 'composition'
  | 'aggregation'
  | 'association'
  | 'dependency'
  | 'link';

export type Visibility = '+' | '-' | '#' | '~' | '';

export interface Member {
  name: string;
  visibility: Visibility;
  isMethod: boolean;
  /** Normalized text of the member, used to compare two versions of a design. */
  signature: string;
}

export interface ClassNode {
  name: string;
  kind: ClassKind;
  members: Member[];
  line: number;
}

/**
 * Direction convention: `from` is the side that depends on `to`.
 * Subclass to superclass, implementer to interface, whole to part, user to used.
 */
export interface Relationship {
  from: string;
  to: string;
  kind: RelationKind;
  label?: string;
  line: number;
}

const USES: ReadonlySet<RelationKind> = new Set(['association', 'dependency', 'composition', 'aggregation']);
const EXTENDS: ReadonlySet<RelationKind> = new Set(['inheritance', 'realization']);

export class DesignModel {
  readonly classes: readonly ClassNode[];
  readonly relationships: readonly Relationship[];
  private readonly byName: ReadonlyMap<string, ClassNode>;

  constructor(classes: ClassNode[], relationships: Relationship[]) {
    this.classes = classes;
    this.relationships = relationships;
    this.byName = new Map(classes.map((c) => [c.name, c]));
  }

  static empty(): DesignModel {
    return new DesignModel([], []);
  }

  get isEmpty(): boolean {
    return this.classes.length === 0;
  }

  findClass(name: string): ClassNode | undefined {
    return this.byName.get(name);
  }

  methodsOf(name: string): Member[] {
    return this.findClass(name)?.members.filter((m) => m.isMethod) ?? [];
  }

  attributesOf(name: string): Member[] {
    return this.findClass(name)?.members.filter((m) => !m.isMethod) ?? [];
  }

  relationshipsOf(name: string): Relationship[] {
    return this.relationships.filter((r) => r.from === name || r.to === name);
  }

  /** Classes this class uses directly (association, dependency, composition, aggregation). */
  dependenciesOf(name: string): string[] {
    return unique(this.relationships.filter((r) => r.from === name && USES.has(r.kind)).map((r) => r.to));
  }

  /** Classes that extend or implement this one. */
  subtypesOf(name: string): string[] {
    return unique(this.relationships.filter((r) => r.to === name && EXTENDS.has(r.kind)).map((r) => r.from));
  }

  /** Length of the longest chain of supertypes above this class. */
  inheritanceDepth(name: string, seen: ReadonlySet<string> = new Set()): number {
    if (seen.has(name)) return 0;
    const parents = this.relationships.filter((r) => r.from === name && EXTENDS.has(r.kind)).map((r) => r.to);
    const nextSeen = new Set(seen).add(name);
    return parents.reduce((max, parent) => Math.max(max, 1 + this.inheritanceDepth(parent, nextSeen)), 0);
  }

  /**
   * Groups of classes that depend on each other in a loop (strongly connected
   * components of size 2 or more). A class that refers to itself is not a loop.
   */
  dependencyCycles(): string[][] {
    const names = unique(this.relationships.flatMap((r) => [r.from, r.to]));
    const edges = new Map(names.map((n) => [n, this.dependenciesOf(n).filter((d) => d !== n)]));
    return stronglyConnected(names, edges)
      .filter((group) => group.length > 1)
      .map((group) => [...group].sort())
      .sort((a, b) => a.join().localeCompare(b.join()));
  }
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

// Tarjan's algorithm. Designs have tens of classes, so recursion depth is not a concern.
function stronglyConnected(nodes: string[], edges: ReadonlyMap<string, string[]>): string[][] {
  let counter = 0;
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const groups: string[][] = [];

  const visit = (node: string): void => {
    index.set(node, counter);
    low.set(node, counter);
    counter += 1;
    stack.push(node);
    onStack.add(node);

    for (const next of edges.get(node) ?? []) {
      if (!index.has(next)) {
        visit(next);
        low.set(node, Math.min(low.get(node)!, low.get(next)!));
      } else if (onStack.has(next)) {
        low.set(node, Math.min(low.get(node)!, index.get(next)!));
      }
    }

    if (low.get(node) === index.get(node)) {
      const group: string[] = [];
      let member: string | undefined;
      do {
        member = stack.pop()!;
        onStack.delete(member);
        group.push(member);
      } while (member !== node);
      groups.push(group);
    }
  };

  for (const node of nodes) {
    if (!index.has(node)) visit(node);
  }
  return groups;
}
