import type { SubmissionContent } from '../../../shared/types.ts';

/** Something a design is expected to model, with the names learners commonly give it. */
export interface Concept {
  name: string;
  synonyms: string[];
}

/** A part of the problem that is likely to change, so it deserves an abstraction. */
export interface VariationPoint {
  id: string;
  name: string;
  why: string;
  /** Name fragments that suggest an abstraction exists for it (PricingStrategy, FeeCalculator...). */
  synonyms: string[];
  suggestion: string;
}

export interface EdgeCase {
  id: string;
  description: string;
  /** Lower-case fragments that show the notes at least discuss it. */
  keywords: string[];
}

/** The interviewer's follow-up: a new requirement that tests how the design absorbs change. */
export interface Twist {
  id: string;
  title: string;
  prompt: string;
}

export interface Problem {
  slug: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  timeboxMinutes: number;
  summary: string;
  context: string;
  origin?: string;
  requirements: string[];
  outOfScope: string[];
  concepts: Concept[];
  variationPoints: VariationPoint[];
  edgeCases: EdgeCase[];
  /** Different designs that are all acceptable. Given to the reviewer so it does not reward one shape. */
  acceptedVariants: string[];
  twist: Twist;
  starterDiagram: string;
  /** A deliberately imperfect design, so a first-time visitor can see real feedback quickly. */
  sample?: SubmissionContent;
}
