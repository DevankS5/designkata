import type { Problem } from '../domain/problem.ts';

export const parkingLot: Problem = {
  slug: 'parking-lot',
  title: 'Parking Lot',
  difficulty: 'Easy',
  timeboxMinutes: 45,
  summary: 'A multi-level lot with different spot sizes, tickets at the gate and pricing that keeps changing.',
  context:
    'A mall in Noida is replacing paper parking slips with an automated lot. Bikes, cars and trucks enter through several gates, get a ticket, park on one of several levels and pay at the exit. The operator wants to change pricing without calling a developer.',
  requirements: [
    'The lot has several levels, and each level has spots of different sizes: compact, regular and large.',
    'At entry, a vehicle (bike, car or truck) gets the nearest free spot that fits it, and a ticket with the entry time and the spot.',
    'At exit, the fee is calculated from the ticket, paid by cash or UPI, and the spot is freed.',
    'A display board shows the free spots per level and per spot size.',
    'Pricing changes over time: hourly slabs today, weekend rates or a flat event price later.',
    'Several gates can issue tickets at the same moment.',
  ],
  outOfScope: ['User accounts and advance booking', 'Payment gateway integration', 'Sensors, barriers and other hardware'],
  concepts: [
    { name: 'ParkingLot', synonyms: ['parkinglot', 'lot', 'garage'] },
    { name: 'Level', synonyms: ['level', 'floor'] },
    { name: 'ParkingSpot', synonyms: ['spot', 'slot', 'space', 'bay'] },
    { name: 'Vehicle', synonyms: ['vehicle', 'car', 'bike', 'truck'] },
    { name: 'Ticket', synonyms: ['ticket', 'token', 'pass'] },
    { name: 'Payment', synonyms: ['payment', 'fee', 'bill', 'invoice', 'receipt'] },
  ],
  variationPoints: [
    {
      id: 'pricing',
      name: 'Pricing',
      why: 'The fee rule changes: hourly slabs, weekend rates, flat event prices.',
      synonyms: ['pricing', 'price', 'fee', 'tariff', 'rate', 'charge', 'billing'],
      suggestion:
        'Put fee calculation behind an interface such as PricingStrategy, so a new pricing rule is a new class instead of an edit to the lot.',
    },
    {
      id: 'spot-allocation',
      name: 'Spot allocation',
      why: 'Which free spot a vehicle gets can change: nearest to the gate, lowest level first, best fit by size.',
      synonyms: ['allocation', 'allocator', 'assignment', 'assigner', 'finder', 'selector', 'parkingstrategy', 'spotstrategy'],
      suggestion: 'An interface such as SpotAllocationStrategy keeps the rule for choosing a spot swappable.',
    },
    {
      id: 'payment-method',
      name: 'Payment method',
      why: 'Cash and UPI today, cards or FASTag later.',
      synonyms: ['paymentmethod', 'paymentprocessor', 'paymentgateway', 'paymentmode', 'payment'],
      suggestion: 'A PaymentMethod interface lets a new way to pay arrive without changing the exit flow.',
    },
  ],
  edgeCases: [
    {
      id: 'lot-full',
      description: 'The lot, or every spot of the needed size, is full.',
      keywords: ['full', 'no spot', 'no free', 'unavailable', 'capacity'],
    },
    {
      id: 'concurrent-entry',
      description: 'Two gates try to give away the same spot at the same moment.',
      keywords: ['concurren', 'simultaneous', 'same time', 'race', 'lock', 'synchron', 'atomic', 'thread'],
    },
    {
      id: 'lost-ticket',
      description: 'A driver loses the ticket before exit.',
      keywords: ['lost', 'lose', 'missing ticket'],
    },
    {
      id: 'payment-failure',
      description: 'Payment fails or is cancelled at the exit.',
      keywords: ['payment fail', 'fails', 'declined', 'failure', 'retry', 'cancel'],
    },
  ],
  acceptedVariants: [
    'Fee calculation can live in a PricingStrategy interface or in a rate table object looked up by vehicle type. Both are fine as long as the lot does not hard-code the rules.',
    'Levels can own their spots, or one SpotManager can own all spots. Both are valid.',
    'Vehicle types can be subclasses or an enum on a single Vehicle class. Subclasses only pay off when behaviour differs by type.',
    'Gates can be separate EntryGate and ExitGate classes or one Gate with a type.',
  ],
  twist: {
    id: 'ev-charging',
    title: 'EV charging spots',
    prompt:
      'The mall adds EV charging spots on level 1. Only EVs may use them, and an EV parked there pays for parking time plus the electricity it used, in rupees per kWh. Update your design. In "What changed and why", list the classes you added and the classes you had to edit.',
  },
  starterDiagram: `classDiagram
  %% Replace this with your design.
  class ParkingLot {
    +park(Vehicle vehicle) Ticket
  }
  class Vehicle
  ParkingLot ..> Vehicle`,
  // A typical first attempt: it works, but one class does everything and nothing can vary without editing it.
  sample: {
    artifacts: [
      {
        kind: 'design-notes',
        sections: {
          requirements: 'Vehicles enter, get a ticket, park, and pay at exit. Support bike, car and truck. The lot has multiple levels.',
          entities:
            'ParkingLot manages everything: levels, spots, tickets and payments. Vehicle has a type. Ticket stores the entry time and the spot.',
          flows:
            'Entry: ParkingLot.parkVehicle loops over the levels to find a free spot of the right type and returns a ticket. Exit: ParkingLot.unparkVehicle calculates the fee with if-else on the vehicle type, takes payment and marks the spot free.',
          patterns: 'Singleton for ParkingLot because there is only one lot.',
          edgeCases: 'If no spot is free, parkVehicle returns null.',
        },
      },
      {
        kind: 'class-diagram',
        format: 'mermaid',
        source: `classDiagram
  class ParkingLot {
    -List~Level~ levels
    -Map~String,Ticket~ activeTickets
    +getInstance() ParkingLot
    +parkVehicle(Vehicle v) Ticket
    +unparkVehicle(String ticketId) double
    +calculateFee(Ticket t) double
    +findFreeSpot(VehicleType type) ParkingSpot
    +processPayment(double amount, String mode) boolean
    +printReceipt(Ticket t)
    +updateDisplayBoard()
    +addLevel(Level l)
    +removeLevel(int id)
  }
  class Level {
    +int id
    +List~ParkingSpot~ spots
  }
  class ParkingSpot {
    +int id
    +VehicleType type
    +boolean isFree
  }
  class Vehicle {
    +String number
    +VehicleType type
  }
  class VehicleType {
    <<enumeration>>
    BIKE
    CAR
    TRUCK
  }
  class Ticket {
    +String id
    +Vehicle vehicle
    +ParkingSpot spot
    +long entryTime
  }
  ParkingLot "1" *-- "many" Level
  Level "1" *-- "many" ParkingSpot
  ParkingLot --> Ticket
  Ticket --> Vehicle
  Ticket --> ParkingSpot`,
      },
    ],
  },
};
