import { describe, expect, it } from 'vitest';
import { parseMermaidClassDiagram } from '../../src/analysis/mermaid-reader.ts';
import { findProblem, listProblems } from '../../src/problems/index.ts';

describe('problem catalog', () => {
  it('has unique slugs and finds problems by slug', () => {
    const slugs = listProblems().map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(findProblem('parking-lot')?.title).toBe('Parking Lot');
    expect(findProblem('does-not-exist')).toBeUndefined();
  });

  describe.each(listProblems().map((p) => [p.slug, p] as const))('%s', (_slug, problem) => {
    it('gives enough context to attempt it', () => {
      expect(problem.requirements.length).toBeGreaterThanOrEqual(4);
      expect(problem.concepts.length).toBeGreaterThanOrEqual(4);
      expect(problem.variationPoints.length).toBeGreaterThanOrEqual(2);
      expect(problem.edgeCases.length).toBeGreaterThanOrEqual(3);
      expect(problem.acceptedVariants.length).toBeGreaterThanOrEqual(2);
      expect(problem.twist.prompt.length).toBeGreaterThan(50);
    });

    it('uses lower-case synonyms and keywords so matching stays simple', () => {
      const words = [
        ...problem.concepts.flatMap((c) => c.synonyms),
        ...problem.variationPoints.flatMap((v) => v.synonyms),
        ...problem.edgeCases.flatMap((e) => e.keywords),
      ];
      for (const word of words) expect(word).toBe(word.toLowerCase());
    });

    it('ships a starter diagram that parses cleanly', () => {
      expect(parseMermaidClassDiagram(problem.starterDiagram).diagnostics).toEqual([]);
    });
  });
});
