import { describe, expect, it } from 'vitest';
import { godClassRule, missingAbstractionRule } from '../../src/evaluation/rules/design-rules.ts';
import { COMPLETE_LOT, contextFor } from '../helpers.ts';

describe('god-class rule', () => {
  it('flags a class with too many methods', () => {
    const methods = Array.from({ length: 10 }, (_, i) => `    +step${i}()`).join('\n');
    const findings = godClassRule.check(contextFor({ diagram: `classDiagram\n  class ParkingLot {\n${methods}\n  }` }));

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ evidence: 'ParkingLot', criterionId: 'responsibilities' });
    expect(findings[0]!.message).toContain('10 methods');
  });

  it('flags a class that talks to too many others', () => {
    const edges = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((n) => `  Hub --> ${n}`).join('\n');
    const findings = godClassRule.check(contextFor({ diagram: `classDiagram\n${edges}` }));
    expect(findings[0]!.message).toContain('relationships with 7 classes');
  });

  it('leaves a focused class alone', () => {
    expect(godClassRule.check(contextFor({ diagram: COMPLETE_LOT }))).toEqual([]);
  });
});

describe('missing-abstraction rule', () => {
  it('is quiet when every variation point sits behind an interface', () => {
    expect(missingAbstractionRule.check(contextFor({ diagram: COMPLETE_LOT }))).toEqual([]);
  });

  it('accepts an abstraction whose implementations carry the name', () => {
    const findings = missingAbstractionRule.check(
      contextFor({
        diagram: `classDiagram
  class FeeRule {
    <<interface>>
  }
  HourlyPricing ..|> FeeRule
  class SpotAllocator {
    <<interface>>
  }
  class PaymentMethod {
    <<interface>>
  }`,
      }),
    );
    expect(findings).toEqual([]);
  });

  it('warns when a variation point has nothing, and notes when it has only a concrete class', () => {
    const findings = missingAbstractionRule.check(
      contextFor({ diagram: 'classDiagram\n  ParkingLot --> FeeCalculator\n  ParkingLot --> Vehicle' }),
    );

    expect(findings.map((f) => [f.severity, f.evidence ?? null])).toEqual([
      ['info', 'FeeCalculator'],
      ['warning', null],
      ['warning', null],
    ]);
    expect(findings[1]!.message).toBe(
      'Spot allocation varies (which free spot a vehicle gets can change: nearest to the gate, lowest level first, best fit by size) but nothing in the diagram abstracts it.',
    );
  });
});
