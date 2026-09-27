import type { SubmissionContent } from '../../../shared/types.ts';
import { parkingLot } from '../../src/problems/parking-lot.ts';

// Three Parking Lot designs of known, different quality. A trustworthy reviewer
// must rank them weak < medium < strong on (almost) every criterion.

const content = (sections: Record<string, string>, source: string): SubmissionContent => ({
  artifacts: [
    { kind: 'design-notes', sections },
    { kind: 'class-diagram', format: 'mermaid', source },
  ],
});

/** One class does everything; fees are an if-else; state is public. */
export const weak = parkingLot.sample!;

/** Allocation and pricing are split out and pricing is an interface, but payment and edge cases are thin. */
export const medium = content(
  {
    requirements: 'Park and unpark bikes, cars and trucks on several levels. Issue a ticket at entry and charge at exit. Pricing will change.',
    entities:
      'ParkingLot coordinates entry and exit. SpotManager finds a free spot. PricingStrategy calculates the fee. Ticket records the entry time and the spot.',
    flows:
      'Entry: ParkingLot asks SpotManager for a free spot that fits the vehicle and creates a Ticket. Exit: ParkingLot asks the PricingStrategy for the fee, takes payment and frees the spot.',
    patterns: 'Strategy for pricing because the rules change. SpotManager keeps allocation out of ParkingLot.',
    edgeCases: 'If no spot fits, entry is refused.',
  },
  `classDiagram
  class ParkingLot {
    -SpotManager spots
    -PricingStrategy pricing
    +park(Vehicle v) Ticket
    +unpark(Ticket t) Money
    +pay(Money amount, String mode) boolean
  }
  class SpotManager {
    -List~Level~ levels
    +findSpot(Vehicle v) ParkingSpot
    +free(ParkingSpot s)
  }
  class PricingStrategy {
    <<interface>>
    +fee(Ticket t) Money
  }
  class HourlyPricing
  class Level {
    +List~ParkingSpot~ spots
  }
  class ParkingSpot {
    +SpotSize size
    +boolean free
  }
  class Vehicle {
    +String plate
    +VehicleType type
  }
  class Ticket {
    +Vehicle vehicle
    +ParkingSpot spot
    +long entryTime
  }
  HourlyPricing ..|> PricingStrategy
  ParkingLot --> SpotManager
  ParkingLot --> PricingStrategy
  SpotManager *-- Level
  Level *-- ParkingSpot
  Ticket --> ParkingSpot
  Ticket --> Vehicle`,
);

/** Every variation point behind an interface, private state, owned edge cases and justified choices. */
export const strong = content(
  {
    requirements:
      'Must: park and unpark bikes, cars and trucks across levels; nearest fitting spot; ticket at entry; fee and payment (cash, UPI) at exit; free-spot board per level and size; several gates at once. Out of scope: bookings, accounts, hardware. Assumptions: one lot, prices in rupees, a lost ticket is charged the daily maximum.',
    entities:
      'ParkingLot coordinates gates and levels but holds no rules. SpotAllocator chooses a spot and reserves it atomically. PricingStrategy computes a fee from a Ticket. PaymentMethod takes money. Ticket is immutable entry data. DisplayBoard listens for spot changes.',
    flows:
      'Entry: EntryGate asks SpotAllocator for a spot; the allocator reserves it with a compare-and-set so two gates cannot take the same spot; a Ticket is issued. Exit: ExitGate asks PricingStrategy for the fee, charges it through PaymentMethod, and only then releases the spot, which notifies DisplayBoard.',
    patterns:
      'Strategy for pricing, allocation and payment, because each varies independently. Observer for the display board so spots do not know about screens. Rejected: vehicle subclasses, because behaviour does not differ by type yet; an enum is enough.',
    edgeCases:
      'Lot full: SpotAllocator returns nothing and the gate refuses entry. Concurrent gates: reservation is atomic per spot. Lost ticket: ExitGate charges the daily maximum after checking the plate. Payment failure: the spot stays occupied and the driver can retry or pay another way.',
  },
  `classDiagram
  class ParkingLot {
    -List~Level~ levels
    +entryGate(int id) EntryGate
    +exitGate(int id) ExitGate
  }
  class EntryGate {
    -SpotAllocator allocator
    +admit(Vehicle v) Ticket
  }
  class ExitGate {
    -PricingStrategy pricing
    -PaymentMethod payment
    +release(Ticket t) Receipt
  }
  class SpotAllocator {
    <<interface>>
    +reserve(Vehicle v) ParkingSpot
  }
  class NearestSpotAllocator
  class PricingStrategy {
    <<interface>>
    +fee(Ticket t) Money
  }
  class HourlySlabPricing
  class PaymentMethod {
    <<interface>>
    +charge(Money amount) PaymentResult
  }
  class UpiPayment
  class CashPayment
  class Level {
    -List~ParkingSpot~ spots
    +freeSpots(SpotSize size) int
  }
  class ParkingSpot {
    -SpotSize size
    -boolean occupied
    +tryOccupy() boolean
    +release()
  }
  class Ticket {
    -String id
    -Vehicle vehicle
    -ParkingSpot spot
    -Instant entry
  }
  class Vehicle {
    -String plate
    -VehicleType type
  }
  class DisplayBoard {
    +onSpotChanged(Level level)
  }
  NearestSpotAllocator ..|> SpotAllocator
  HourlySlabPricing ..|> PricingStrategy
  UpiPayment ..|> PaymentMethod
  CashPayment ..|> PaymentMethod
  ParkingLot *-- Level
  ParkingLot *-- EntryGate
  ParkingLot *-- ExitGate
  Level *-- ParkingSpot
  EntryGate --> SpotAllocator
  ExitGate --> PricingStrategy
  ExitGate --> PaymentMethod
  Ticket --> ParkingSpot
  Ticket --> Vehicle
  Level ..> DisplayBoard`,
);
