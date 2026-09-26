import { describe, expect, it } from 'vitest';
import { diffModels } from '../../src/analysis/change-impact.ts';
import { parseMermaidClassDiagram } from '../../src/analysis/mermaid-reader.ts';

const model = (source: string) => parseMermaidClassDiagram(`classDiagram\n${source}`).model;

const V1 = `
  class ParkingLot {
    +park(Vehicle v) Ticket
  }
  class ParkingSpot {
    +fits(Vehicle v) bool
  }
  class PricingStrategy {
    <<interface>>
    +price(Ticket t) Money
  }
  HourlyPricing ..|> PricingStrategy
  ParkingLot --> PricingStrategy
  ParkingLot *-- ParkingSpot`;

describe('diffModels', () => {
  it('calls a change additive when only new classes appear', () => {
    const impact = diffModels(
      model(V1),
      model(`${V1}
  EVChargingSpot --|> ParkingSpot
  KwhPricing ..|> PricingStrategy`),
    );

    expect(impact).toMatchObject({
      addedClasses: ['EVChargingSpot', 'KwhPricing'],
      removedClasses: [],
      modifiedClasses: [],
      blastRadius: 0,
      label: 'additive',
    });
    expect(impact.addedRelationships).toEqual([
      'EVChargingSpot extends ParkingSpot',
      'KwhPricing implements PricingStrategy',
    ]);
  });

  it('counts an existing class that had to change', () => {
    const impact = diffModels(
      model(V1),
      model(V1.replace('+park(Vehicle v) Ticket', '+park(Vehicle v) Ticket\n    +parkEV(ElectricVehicle v) Ticket')),
    );

    expect(impact.modifiedClasses).toEqual([
      { name: 'ParkingLot', added: ['+parkEV(ElectricVehicle v) Ticket'], removed: [] },
    ]);
    expect(impact.label).toBe('localized');
  });

  it('treats a new dependency of an existing class as touching it', () => {
    const impact = diffModels(model(V1), model(`${V1}\n  ParkingLot --> ChargingMeter`));
    expect(impact.modifiedClasses.map((c) => c.name)).toEqual(['ParkingLot']);
    expect(impact.modifiedClasses[0]!.added).toEqual(['new link: ParkingLot uses ChargingMeter']);
  });

  it('counts removed classes and kind changes, and calls three or more touched classes wide', () => {
    const impact = diffModels(
      model(V1),
      model(`
  class ParkingLot {
    +park(Vehicle v) Ticket
    +chargeEV()
  }
  class ParkingSpot {
    <<abstract>>
    +fits(Vehicle v) bool
  }
  class PricingStrategy {
    <<interface>>
    +price(Ticket t) Money
  }
  ParkingLot --> PricingStrategy
  ParkingLot *-- ParkingSpot`),
    );

    expect(impact.removedClasses).toEqual(['HourlyPricing']);
    expect(impact.modifiedClasses.map((c) => c.name)).toEqual(['ParkingLot', 'ParkingSpot']);
    expect(impact.modifiedClasses[1]!.added).toEqual(['now abstract']);
    expect(impact.blastRadius).toBe(3);
    expect(impact.label).toBe('wide');
  });
});
