import { describe, expect, it } from 'vitest';
import { parseMember, parseMermaidClassDiagram } from '../../src/analysis/mermaid-reader.ts';

const parse = (source: string) => parseMermaidClassDiagram(source);
const edges = (source: string) =>
  parse(source).model.relationships.map((r) => `${r.from} ${r.kind} ${r.to}`);

describe('parseMermaidClassDiagram', () => {
  it('reads classes, members and visibility', () => {
    const { model, diagnostics } = parse(`classDiagram
      class ParkingLot {
        -List~Level~ levels
        +park(Vehicle v) Ticket
        +unpark(Ticket t) Money
      }`);

    expect(diagnostics).toEqual([]);
    const lot = model.findClass('ParkingLot')!;
    expect(lot.kind).toBe('class');
    expect(lot.members.map((m) => [m.visibility, m.name, m.isMethod])).toEqual([
      ['-', 'levels', false],
      ['+', 'park', true],
      ['+', 'unpark', true],
    ]);
  });

  it('reads annotations written inside, before and on the class line', () => {
    const { model } = parse(`classDiagram
      class PricingStrategy {
        <<interface>>
        +price(Ticket t) Money
      }
      <<abstract>> Vehicle
      class SpotType <<enumeration>>`);

    expect(model.findClass('PricingStrategy')!.kind).toBe('interface');
    expect(model.findClass('Vehicle')!.kind).toBe('abstract');
    expect(model.findClass('SpotType')!.kind).toBe('enum');
  });

  it('treats a class with an abstract method as abstract', () => {
    const { model } = parse(`classDiagram
      class Shape {
        +area()* double
      }`);
    expect(model.findClass('Shape')!.kind).toBe('abstract');
  });

  it('maps every arrow to the right direction and kind', () => {
    expect(
      edges(`classDiagram
        Vehicle <|-- Car
        Truck --|> Vehicle
        PricingStrategy <|.. HourlyPricing
        FlatPricing ..|> PricingStrategy
        ParkingLot *-- Level
        Spot --* Level
        Garage o-- Vehicle
        Driver --o Fleet
        Gate --> ParkingLot
        Ticket <-- Gate
        Payment ..> Ticket
        Receipt <.. Payment
        Car -- Driver
        Car .. Owner`),
    ).toEqual([
      'Car inheritance Vehicle',
      'Truck inheritance Vehicle',
      'HourlyPricing realization PricingStrategy',
      'FlatPricing realization PricingStrategy',
      'ParkingLot composition Level',
      'Level composition Spot',
      'Garage aggregation Vehicle',
      'Fleet aggregation Driver',
      'Gate association ParkingLot',
      'Gate association Ticket',
      'Payment dependency Ticket',
      'Payment dependency Receipt',
      'Car link Driver',
      'Car link Owner',
    ]);
  });

  it('keeps cardinality out of names and records labels', () => {
    const { model } = parse(`classDiagram
      ParkingLot "1" *-- "many" Level : has
      Customer "1" --> "*" Ticket`);

    expect(model.relationships.map((r) => [r.from, r.to, r.label])).toEqual([
      ['ParkingLot', 'Level', 'has'],
      ['Customer', 'Ticket', undefined],
    ]);
  });

  it('creates classes that only appear in relationships', () => {
    const { model } = parse(`classDiagram
      Elevator --> Door`);
    expect(model.classes.map((c) => c.name)).toEqual(['Elevator', 'Door']);
  });

  it('reads generics, member shorthand and namespaces', () => {
    const { model, diagnostics } = parse(`classDiagram
      namespace Payments {
        class Wallet~T~ {
          +balance() T
        }
      }
      Wallet : +topUp(amount)`);

    expect(diagnostics).toEqual([]);
    expect(model.methodsOf('Wallet').map((m) => m.name)).toEqual(['balance', 'topUp']);
  });

  it('skips comments and styling lines', () => {
    const { model, diagnostics } = parse(`classDiagram
      %% the core of the lot
      direction RL
      note for Gate "entry and exit"
      class Gate
      style Gate fill:#f9f`);

    expect(diagnostics).toEqual([]);
    expect(model.classes).toHaveLength(1);
  });

  it('warns about lines it cannot read, with the line number', () => {
    const { diagnostics } = parse(`classDiagram
      class Gate
      Gate ==> Lot`);

    expect(diagnostics).toEqual([
      { line: 3, severity: 'warning', message: 'Could not read "Gate ==> Lot", so it was ignored.' },
    ]);
  });

  it('reports a class body that is never closed', () => {
    const { diagnostics } = parse(`classDiagram
      class Gate {
        +open()`);

    expect(diagnostics).toContainEqual({
      line: 2,
      severity: 'error',
      message: 'Class Gate opens a { on line 2 that is never closed.',
    });
  });

  it('asks for the classDiagram header when it is missing', () => {
    const { diagnostics } = parse('class Gate');
    expect(diagnostics).toEqual([
      { line: 1, severity: 'warning', message: 'Start the diagram with a "classDiagram" line.' },
    ]);
  });

  it('returns an empty model for an empty diagram', () => {
    const { model, diagnostics } = parse('');
    expect(model.isEmpty).toBe(true);
    expect(diagnostics).toEqual([]);
  });

  it('does not duplicate a member declared twice', () => {
    const { model } = parse(`classDiagram
      class Gate {
        +open()
      }
      Gate : +open()`);
    expect(model.methodsOf('Gate')).toHaveLength(1);
  });
});

describe('parseMember', () => {
  it.each([
    ['+String owner', 'owner', false],
    ['owner: String', 'owner', false],
    ['-List~Level~ levels', 'levels', false],
    ['+int count$', 'count', false],
    ['+Ticket park(Vehicle v)', 'park', true],
    ['+park(Vehicle v) Ticket', 'park', true],
    ['#area()* double', 'area', true],
  ])('reads %s', (text, name, isMethod) => {
    expect(parseMember(text)).toMatchObject({ name, isMethod });
  });

  it('normalizes spacing in the signature so versions compare cleanly', () => {
    expect(parseMember('+ price( Ticket t ,  Clock c )  Money')!.signature).toBe('+price(Ticket t,Clock c) Money');
  });
});
