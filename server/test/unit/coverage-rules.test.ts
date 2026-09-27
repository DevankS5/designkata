import { describe, expect, it } from 'vitest';
import { edgeCaseRule, missingConceptRule } from '../../src/evaluation/rules/coverage-rules.ts';
import { COMPLETE_LOT, FULL_NOTES, contextFor } from '../helpers.ts';

describe('missing-concept rule', () => {
  it('is quiet when every core concept has a class', () => {
    expect(missingConceptRule.check(contextFor({ diagram: COMPLETE_LOT }))).toEqual([]);
  });

  it('warns about a concept that is nowhere, and only notes one that is discussed', () => {
    const findings = missingConceptRule.check(
      contextFor({
        diagram: 'classDiagram\n  ParkingLot *-- Floor\n  Floor *-- Slot\n  Vehicle --> Ticket',
        notes: { ...FULL_NOTES, flows: 'At exit the driver pays the fee by cash or UPI and the spot is freed for the next car.' },
      }),
    );

    expect(findings).toEqual([
      expect.objectContaining({
        severity: 'info',
        message: 'Payment is discussed in your notes but has no class in the diagram.',
      }),
    ]);
  });

  it('does not run without a diagram', () => {
    expect(missingConceptRule.check(contextFor({}))).toEqual([]);
  });
});

describe('edge-cases rule', () => {
  it('lists the edge cases the notes never mention', () => {
    const findings = edgeCaseRule.check(contextFor({ diagram: COMPLETE_LOT, notes: { requirements: 'Park cars. When the lot is full, refuse entry.' } }));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toBe('Your notes do not mention 3 of the 4 edge cases worth handling.');
    expect(findings[0]!.suggestion).toContain('a driver loses the ticket before exit.');
  });

  it('is quiet when every edge case comes up, or when there are no notes to judge', () => {
    const notes = { edgeCases: 'Full lot, concurrent gates with a lock, a lost ticket, and payment failure with retry.' };
    expect(edgeCaseRule.check(contextFor({ diagram: COMPLETE_LOT, notes }))).toEqual([]);
    expect(edgeCaseRule.check(contextFor({ diagram: COMPLETE_LOT, notes: {} }))).toEqual([]);
  });
});
