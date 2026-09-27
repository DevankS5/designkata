import { describe, expect, it } from 'vitest';
import { EvidenceVerifier } from '../../src/evaluation/evidence-verifier.ts';
import { COMPLETE_LOT, contextFor } from '../helpers.ts';

describe('EvidenceVerifier', () => {
  const analysis = contextFor({ diagram: COMPLETE_LOT }).analysis;
  const verifier = new EvidenceVerifier();

  it('finds exact quotes regardless of case, punctuation and spacing', () => {
    expect(verifier.verify('level OWNS spots', analysis)).toBe(true);
    expect(verifier.verify('Strategy for pricing, because rules change often', analysis)).toBe(true);
    expect(verifier.verify('PricingStrategy', analysis)).toBe(true);
  });

  it('matches a shortened quote piece by piece', () => {
    expect(verifier.verify('When the lot is full ... the gate refuses entry', analysis)).toBe(true);
  });

  it('rejects paraphrases and invented classes', () => {
    expect(verifier.verify('Gate manages the whole lot', analysis)).toBe(false);
    expect(verifier.verify('ParkingAttendant', analysis)).toBe(false);
    expect(verifier.verify('...', analysis)).toBe(false);
  });

  it('only matches whole words', () => {
    expect(verifier.verify('Allocation', analysis)).toBe(false); // only inside SpotAllocationStrategy
    expect(verifier.verify('SpotAllocationStrategy', analysis)).toBe(true);
  });
});
