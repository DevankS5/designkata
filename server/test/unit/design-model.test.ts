import { describe, expect, it } from 'vitest';
import { DesignModel, type ClassNode, type Relationship } from '../../src/domain/design-model.ts';

const cls = (name: string, kind: ClassNode['kind'] = 'class'): ClassNode => ({ name, kind, members: [], line: 1 });
const rel = (from: string, kind: Relationship['kind'], to: string): Relationship => ({ from, to, kind, line: 1 });

describe('DesignModel', () => {
  it('finds dependencies and subtypes in the right direction', () => {
    const model = new DesignModel(
      [cls('ParkingLot'), cls('Level'), cls('PricingStrategy', 'interface'), cls('HourlyPricing')],
      [
        rel('ParkingLot', 'composition', 'Level'),
        rel('ParkingLot', 'association', 'PricingStrategy'),
        rel('HourlyPricing', 'realization', 'PricingStrategy'),
      ],
    );

    expect(model.dependenciesOf('ParkingLot')).toEqual(['Level', 'PricingStrategy']);
    expect(model.subtypesOf('PricingStrategy')).toEqual(['HourlyPricing']);
    expect(model.dependenciesOf('HourlyPricing')).toEqual([]);
  });

  it('measures the longest inheritance chain', () => {
    const model = new DesignModel(
      [cls('Vehicle'), cls('Car'), cls('ElectricCar'), cls('SelfDrivingCar')],
      [
        rel('Car', 'inheritance', 'Vehicle'),
        rel('ElectricCar', 'inheritance', 'Car'),
        rel('SelfDrivingCar', 'inheritance', 'ElectricCar'),
      ],
    );

    expect(model.inheritanceDepth('Vehicle')).toBe(0);
    expect(model.inheritanceDepth('SelfDrivingCar')).toBe(3);
  });

  it('does not loop forever on a malformed inheritance cycle', () => {
    const model = new DesignModel([cls('A'), cls('B')], [rel('A', 'inheritance', 'B'), rel('B', 'inheritance', 'A')]);
    expect(model.inheritanceDepth('A')).toBe(2);
  });

  it('reports classes that depend on each other in a loop', () => {
    const model = new DesignModel(
      [cls('Elevator'), cls('Controller'), cls('Display'), cls('Door')],
      [
        rel('Elevator', 'association', 'Controller'),
        rel('Controller', 'dependency', 'Display'),
        rel('Display', 'association', 'Elevator'),
        rel('Elevator', 'composition', 'Door'),
      ],
    );

    expect(model.dependencyCycles()).toEqual([['Controller', 'Display', 'Elevator']]);
  });

  it('ignores self references and inheritance when looking for loops', () => {
    const model = new DesignModel(
      [cls('Employee'), cls('Manager')],
      [rel('Employee', 'association', 'Employee'), rel('Manager', 'inheritance', 'Employee'), rel('Employee', 'association', 'Manager')],
    );

    expect(model.dependencyCycles()).toEqual([]);
  });
});
