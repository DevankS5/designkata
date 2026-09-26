import type { Problem } from '../domain/problem.ts';
import { parkingLot } from './parking-lot.ts';

// Problems are data. A new problem is a new file added to this list, with no other code change.
const problems: readonly Problem[] = [parkingLot];
const bySlug = new Map(problems.map((p) => [p.slug, p]));

export function listProblems(): readonly Problem[] {
  return problems;
}

export function findProblem(slug: string): Problem | undefined {
  return bySlug.get(slug);
}
