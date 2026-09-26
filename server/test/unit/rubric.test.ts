import { describe, expect, it } from 'vitest';
import { CRITERION_IDS, RUBRIC } from '../../src/domain/rubric.ts';

describe('RUBRIC', () => {
  it('has six distinct criteria', () => {
    expect(new Set(CRITERION_IDS).size).toBe(6);
  });

  it('anchors every criterion at all four levels', () => {
    for (const criterion of RUBRIC) {
      expect(Object.keys(criterion.levels)).toEqual(['1', '2', '3', '4']);
      for (const anchor of Object.values(criterion.levels)) expect(anchor.length).toBeGreaterThan(10);
    }
  });
});
