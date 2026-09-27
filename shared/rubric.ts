import type { CriterionDefinition, CriterionId } from './types.ts';

// Six criteria, each judged on four anchored levels. Anchors describe what a
// design at that level looks like, so two different designs can both reach 4.
// There is deliberately no overall score.
export const RUBRIC: readonly CriterionDefinition[] = [
  {
    id: 'requirements',
    name: 'Requirements and scope',
    question: 'Did the learner pin down what the system must do, what it will not do, and the assumptions in between?',
    levels: {
      1: 'Restates the problem. No assumptions and no scope.',
      2: 'Lists features but misses a key requirement or constraint from the brief.',
      3: 'Covers the core requirements and states assumptions.',
      4: 'Also prioritises, names what is out of scope, and calls out concerns such as concurrency or future change.',
    },
  },
  {
    id: 'responsibilities',
    name: 'Responsibilities and cohesion',
    question: 'Does each class have one clear job, with behaviour next to the data it needs?',
    levels: {
      1: 'One or two classes do almost everything.',
      2: 'Many classes, but responsibilities overlap or sit in the wrong class.',
      3: 'Mostly one clear job per class, with a few leaks.',
      4: 'Each class has one reason to change, and behaviour sits with the data it needs.',
    },
  },
  {
    id: 'coupling',
    name: 'Relationships, coupling and encapsulation',
    question: 'Are relationships the right kind, dependencies minimal, and internal state protected?',
    levels: {
      1: 'Classes reach into each other freely, or relationship types are wrong or missing.',
      2: 'Relationships make sense, but there is needless coupling or exposed mutable state.',
      3: 'Sensible composition and association, few cycles, state mostly private.',
      4: 'Dependencies point at abstractions, composition is preferred where it fits, and state changes only through methods.',
    },
  },
  {
    id: 'extensibility',
    name: 'Abstraction and extensibility',
    question: 'Are the parts that will change behind abstractions, so new variants arrive without editing existing classes?',
    levels: {
      1: 'No abstraction where the problem clearly varies; type checks or switches decide behaviour.',
      2: 'Abstractions exist, but not where the problem varies, or the varying parts are still hard-coded.',
      3: 'The main variation points sit behind interfaces or abstract classes.',
      4: 'New variants plug in without modifying existing classes, and the answer to the twist shows it.',
    },
  },
  {
    id: 'behaviour',
    name: 'Behaviour and edge cases',
    question: 'Are the key flows and the awkward cases handled, each with a clear owner?',
    levels: {
      1: 'Only static structure. No flows.',
      2: 'The main flow only.',
      3: 'Main flows plus some edge cases, such as full capacity or invalid input.',
      4: 'Edge cases, concurrency and failure paths each have a clear owner in the design.',
    },
  },
  {
    id: 'tradeoffs',
    name: 'Trade-offs and communication',
    question: 'Are choices justified, alternatives weighed, and patterns used only where they earn their place?',
    levels: {
      1: 'No justification for any choice.',
      2: 'Patterns named without saying why, or used where they add nothing.',
      3: 'The main choices are justified.',
      4: 'Alternatives weighed, trade-offs explicit, and pattern use in proportion to the problem.',
    },
  },
];

export const CRITERION_IDS: readonly CriterionId[] = RUBRIC.map((c) => c.id);

export function criterionName(id: CriterionId): string {
  return RUBRIC.find((c) => c.id === id)?.name ?? id;
}
