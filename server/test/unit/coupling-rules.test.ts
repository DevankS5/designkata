import { describe, expect, it } from 'vitest';
import {
  deepInheritanceRule,
  dependencyCycleRule,
  orphanClassRule,
  publicStateRule,
} from '../../src/evaluation/rules/coupling-rules.ts';
import { parkingLot } from '../../src/problems/parking-lot.ts';
import { COMPLETE_LOT, FULL_NOTES, contextFor } from '../helpers.ts';

const check = (rule: typeof dependencyCycleRule, diagram: string, notes = FULL_NOTES) => rule.check(contextFor({ diagram, notes }));

describe('dependency-cycle rule', () => {
  it('notes a pair that depends on each other and warns about a longer loop', () => {
    expect(check(dependencyCycleRule, 'classDiagram\n  Lot --> Gate\n  Gate --> Lot').map((f) => [f.severity, f.message])).toEqual([
      ['info', 'Gate and Lot depend on each other.'],
    ]);
    expect(check(dependencyCycleRule, 'classDiagram\n  A --> B\n  B --> C\n  C --> A')[0]).toMatchObject({
      severity: 'warning',
      message: 'A, B and C depend on each other in a loop.',
    });
  });

  it('is quiet for a design without loops', () => {
    expect(check(dependencyCycleRule, COMPLETE_LOT)).toEqual([]);
  });
});

describe('orphan-class rule', () => {
  it('flags a class with no relationships that nobody mentions', () => {
    const findings = check(orphanClassRule, 'classDiagram\n  A --> B\n  B --> C\n  class Leftover\n  class Ticket\n  class Vehicle');
    expect(findings.map((f) => f.evidence)).toEqual(['Leftover', 'Ticket', 'Vehicle']);
  });

  it('counts a class used as a field type as connected, and ignores enums', () => {
    const findings = check(
      orphanClassRule,
      'classDiagram\n  A --> B\n  class Ticket {\n    +Vehicle vehicle\n  }\n  class Vehicle\n  class Size {\n    <<enumeration>>\n  }\n  A --> Ticket',
    );
    expect(findings).toEqual([]);
  });

  it('does not judge tiny diagrams', () => {
    expect(check(orphanClassRule, 'classDiagram\n  class A\n  class B')).toEqual([]);
  });
});

describe('public-state rule', () => {
  it('lists every class with public fields in one note', () => {
    const findings = publicStateRule.check(contextFor({ diagram: (parkingLot.sample!.artifacts[1] as { source: string }).source }));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toBe(
      '4 classes expose public fields: Level (id, spots); ParkingSpot (id, type, isFree); Vehicle (number, type); Ticket (id, vehicle, spot, entryTime).',
    );
  });

  it('ignores private fields, methods, interfaces and enums', () => {
    expect(check(publicStateRule, COMPLETE_LOT)).toEqual([]);
  });
});

describe('deep-inheritance rule', () => {
  it('warns past three levels', () => {
    const findings = check(deepInheritanceRule, 'classDiagram\n  B --|> A\n  C --|> B\n  D --|> C\n  E --|> D');
    expect(findings.map((f) => f.evidence)).toEqual(['E']);
    expect(check(deepInheritanceRule, 'classDiagram\n  B --|> A\n  C --|> B\n  D --|> C')).toEqual([]);
  });
});
