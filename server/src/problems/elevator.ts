import type { Problem } from '../domain/problem.ts';

export const elevator: Problem = {
  slug: 'elevator',
  title: 'Elevator System',
  difficulty: 'Hard',
  timeboxMinutes: 60,
  summary: 'Several cars, hall and car calls, a dispatching rule you can swap, and cars that go out of service.',
  context:
    'A 20-floor office tower in Gurugram has 4 elevators. People press up or down on a floor, or a floor number inside a car. At 9 am the lobby is packed, so the building wants waiting time low and wants to try different dispatching rules without rewriting the system.',
  requirements: [
    'The building has N floors and M elevator cars.',
    'Hall call: a person on a floor presses up or down, and the system assigns a car.',
    'Car call: inside a car, a person presses a destination floor.',
    'Each car moves up or down, stops at requested floors, and opens and closes its doors.',
    'The dispatching rule (nearest car, least busy, zoning) must be replaceable.',
    'A car can be put into maintenance, after which it takes no new requests.',
    'A car that is full does not stop for new hall calls.',
  ],
  outOfScope: ['Motor control and physical safety systems', 'Button panel UI', 'Energy optimisation'],
  concepts: [
    { name: 'ElevatorSystem', synonyms: ['system', 'controller', 'building', 'bank', 'manager'] },
    { name: 'Elevator', synonyms: ['elevator', 'car', 'lift', 'cabin'] },
    { name: 'Request', synonyms: ['request', 'call'] },
    { name: 'Floor', synonyms: ['floor', 'level'] },
    { name: 'Door', synonyms: ['door'] },
  ],
  variationPoints: [
    {
      id: 'dispatching',
      name: 'Dispatching',
      why: 'Which car answers a hall call is the thing the building wants to experiment with.',
      synonyms: ['dispatch', 'scheduler', 'scheduling', 'assignment', 'selector', 'strategy', 'algorithm'],
      suggestion:
        'A DispatchStrategy interface (NearestCar, LeastBusy, Zoned) keeps the choice of car replaceable without touching the cars.',
    },
    {
      id: 'car-state',
      name: 'Car state',
      why: 'What a car may do depends on whether it is idle, moving up, moving down or in maintenance.',
      synonyms: ['state', 'mode', 'status'],
      suggestion: 'An ElevatorState (Idle, MovingUp, MovingDown, Maintenance) keeps the rules for each state in one place.',
    },
  ],
  edgeCases: [
    {
      id: 'simultaneous-calls',
      description: 'Two hall calls arrive at once and both want the same car.',
      keywords: ['concurren', 'simultaneous', 'same time', 'race', 'lock', 'queue', 'synchron'],
    },
    {
      id: 'full-car',
      description: 'The car is at its capacity.',
      keywords: ['full', 'capacity', 'overload', 'weight'],
    },
    {
      id: 'maintenance',
      description: 'A car goes into maintenance while it still has pending requests.',
      keywords: ['maintenance', 'out of service', 'reassign', 'broken', 'fault'],
    },
    {
      id: 'same-floor',
      description: 'Someone presses the floor the car is already on.',
      keywords: ['same floor', 'already at', 'current floor'],
    },
  ],
  acceptedVariants: [
    'Requests can be queued per car or in one central queue that the dispatcher reads. Both are fine if the assignment rule lives in one place.',
    'Direction and state can be one enum or the State pattern.',
    'Doors can be their own class or part of the car. A separate class pays off when door behaviour (obstruction, timeouts) grows.',
  ],
  twist: {
    id: 'fire-mode',
    title: 'Fire emergency mode',
    prompt:
      'The building adds a fire mode. When the alarm goes off, every car drops its requests, goes straight to the ground floor, opens its doors and ignores all calls until a firefighter key switches it back. Update your design and explain what changed.',
  },
  starterDiagram: `classDiagram
  %% Replace this with your design.
  class Elevator {
    +moveTo(int floor)
  }
  class Request`,
};
