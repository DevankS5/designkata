import type { ClassDiagramArtifact } from '../../../shared/types.ts';
import {
  DesignModel,
  type ClassKind,
  type ClassNode,
  type Member,
  type Relationship,
  type RelationKind,
  type Visibility,
} from '../domain/design-model.ts';
import type { ArtifactReader, ArtifactReading, Diagnostic } from './artifact-reader.ts';

// ponytail: a line-based reader for the subset of Mermaid classDiagram that
// learners actually write (classes, members, annotations, relationships,
// cardinality, labels, namespaces). Styling and interaction lines are skipped.

const NAME = String.raw`[A-Za-z_][\w]*`;
const GENERIC = String.raw`(?:~[^~]*~)?`;

const CLASS_LINE = new RegExp(
  String.raw`^class\s+(${NAME})${GENERIC}(?:\s*\["[^"]*"\])?\s*(?:<<\s*([\w ]+?)\s*>>)?\s*(?::::\s*\w+)?\s*(\{)?\s*(\})?$`,
);
const ANNOTATION_LINE = new RegExp(String.raw`^<<\s*([\w ]+?)\s*>>\s*(${NAME})?$`);
const RELATION_LINE = new RegExp(
  String.raw`^(${NAME})${GENERIC}\s*(?:"([^"]*)"\s*)?(<\||\*|o|<)?(--|\.\.)(\|>|\*|o|>)?\s*(?:"([^"]*)"\s*)?(${NAME})${GENERIC}\s*(?::\s*(.*))?$`,
);
const MEMBER_LINE = new RegExp(String.raw`^(${NAME})\s*:\s*(.+)$`);
// Mermaid marks an abstract method with * at the end; learners also write it right after ().
const ABSTRACT_METHOD = /\)\*|\*$/;
const IGNORED = /^(direction\s|note\b|click\s|link\s|callback\s|style\s|classDef\s|cssClass\s|accTitle|accDescr|title\s)/;

export function parseMermaidClassDiagram(source: string): { model: DesignModel; diagnostics: Diagnostic[] } {
  const classes = new Map<string, ClassNode>();
  const relationships: Relationship[] = [];
  const diagnostics: Diagnostic[] = [];
  let sawHeader = false;
  let openClass: { name: string; line: number } | undefined;
  let namespaceDepth = 0;

  const ensureClass = (name: string, line: number): ClassNode => {
    let node = classes.get(name);
    if (!node) {
      node = { name, kind: 'class', members: [], line };
      classes.set(name, node);
    }
    return node;
  };

  const lines = source.split(/\r?\n/);
  lines.forEach((raw, index) => {
    const lineNo = index + 1;
    const line = raw.trim();
    if (!line || line.startsWith('%%')) return;

    if (openClass) {
      const closes = line.endsWith('}');
      const body = closes ? line.slice(0, -1).trim() : line;
      if (body) {
        const annotation = /^<<\s*([\w ]+?)\s*>>$/.exec(body);
        const node = ensureClass(openClass.name, openClass.line);
        if (annotation) node.kind = kindFromAnnotation(annotation[1]!, node.kind);
        else addMember(node, body);
      }
      if (closes) openClass = undefined;
      return;
    }

    if (/^classDiagram(-v2)?$/.test(line)) {
      sawHeader = true;
      return;
    }
    if (IGNORED.test(line)) return;

    const namespace = /^namespace\s+[\w.]+\s*\{$/.exec(line);
    if (namespace) {
      namespaceDepth += 1;
      return;
    }
    if (line === '}' && namespaceDepth > 0) {
      namespaceDepth -= 1;
      return;
    }

    const classMatch = CLASS_LINE.exec(line);
    if (classMatch) {
      const [, name, annotation, open, close] = classMatch;
      const node = ensureClass(name!, lineNo);
      if (annotation) node.kind = kindFromAnnotation(annotation, node.kind);
      if (open && !close) openClass = { name: name!, line: lineNo };
      return;
    }

    const annotationMatch = ANNOTATION_LINE.exec(line);
    if (annotationMatch && annotationMatch[2]) {
      const node = ensureClass(annotationMatch[2], lineNo);
      node.kind = kindFromAnnotation(annotationMatch[1]!, node.kind);
      return;
    }

    const relation = RELATION_LINE.exec(line);
    if (relation) {
      const [, left, , leftHead, style, rightHead, , right, label] = relation;
      ensureClass(left!, lineNo);
      ensureClass(right!, lineNo);
      for (const r of toRelationships(left!, right!, leftHead, style as '--' | '..', rightHead)) {
        relationships.push({ ...r, line: lineNo, ...(label?.trim() ? { label: label.trim() } : {}) });
      }
      return;
    }

    const memberMatch = MEMBER_LINE.exec(line);
    if (memberMatch) {
      addMember(ensureClass(memberMatch[1]!, lineNo), memberMatch[2]!);
      return;
    }

    diagnostics.push({ line: lineNo, severity: 'warning', message: `Could not read "${truncate(line)}", so it was ignored.` });
  });

  if (openClass) {
    diagnostics.push({
      line: openClass.line,
      severity: 'error',
      message: `Class ${openClass.name} opens a { on line ${openClass.line} that is never closed.`,
    });
  }
  if (!sawHeader && classes.size > 0) {
    diagnostics.push({ line: 1, severity: 'warning', message: 'Start the diagram with a "classDiagram" line.' });
  }

  for (const node of classes.values()) {
    if (node.kind === 'class' && node.members.some((m) => m.isMethod && ABSTRACT_METHOD.test(m.signature))) {
      node.kind = 'abstract';
    }
  }

  return { model: new DesignModel([...classes.values()], relationships), diagnostics };
}

function toRelationships(
  left: string,
  right: string,
  leftHead: string | undefined,
  style: '--' | '..',
  rightHead: string | undefined,
): Omit<Relationship, 'line'>[] {
  const dashed = style === '..';
  const result: Omit<Relationship, 'line'>[] = [];
  const add = (from: string, kind: RelationKind, to: string) => result.push({ from, kind, to });

  // A head sits next to the class it describes: <| marks the supertype, * and o mark the whole.
  if (leftHead === '<|') add(right, dashed ? 'realization' : 'inheritance', left);
  if (leftHead === '*') add(left, 'composition', right);
  if (leftHead === 'o') add(left, 'aggregation', right);
  if (leftHead === '<') add(right, dashed ? 'dependency' : 'association', left);
  if (rightHead === '|>') add(left, dashed ? 'realization' : 'inheritance', right);
  if (rightHead === '*') add(right, 'composition', left);
  if (rightHead === 'o') add(right, 'aggregation', left);
  if (rightHead === '>') add(left, dashed ? 'dependency' : 'association', right);
  if (!leftHead && !rightHead) add(left, 'link', right);
  return result;
}

function addMember(node: ClassNode, text: string): void {
  const member = parseMember(text);
  if (member && !node.members.some((m) => m.signature === member.signature)) node.members.push(member);
}

export function parseMember(text: string): Member | undefined {
  let rest = text.trim();
  if (!rest) return undefined;

  let visibility: Visibility = '';
  if (/^[+\-#~]/.test(rest)) {
    visibility = rest[0] as Visibility;
    rest = rest.slice(1).trim();
  }

  const isMethod = rest.includes('(');
  const signature =
    visibility +
    rest
      .replace(/\s+/g, ' ')
      .replace(/\s*([(,:])\s*/g, '$1')
      .replace(/\s+\)/g, ')');
  const head = isMethod ? rest.slice(0, rest.indexOf('(')) : rest.split(':')[0]!;
  const words = head.replace(/[$*]+$/, '').trim().split(/\s+/);
  const name = (isMethod || !rest.includes(':') ? words[words.length - 1] : words[0])!.replace(/[$*]+$/, '');

  return name ? { name, visibility, isMethod, signature } : undefined;
}

function kindFromAnnotation(annotation: string, current: ClassKind): ClassKind {
  const value = annotation.toLowerCase().trim();
  if (value === 'interface') return 'interface';
  if (value === 'abstract') return 'abstract';
  if (value === 'enumeration' || value === 'enum') return 'enum';
  return current;
}

function truncate(text: string): string {
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}

export class MermaidClassDiagramReader implements ArtifactReader<ClassDiagramArtifact> {
  readonly kind = 'class-diagram' as const;

  read(artifact: ClassDiagramArtifact): ArtifactReading {
    const { model, diagnostics } = parseMermaidClassDiagram(artifact.source);
    return { model, diagnostics, text: artifact.source };
  }
}
