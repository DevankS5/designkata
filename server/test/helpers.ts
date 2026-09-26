import type { NoteSections, SubmissionContent } from '../../shared/types.ts';
import { SubmissionAnalyzer } from '../src/analysis/submission-analyzer.ts';
import type { Problem } from '../src/domain/problem.ts';
import type { EvaluationContext } from '../src/evaluation/evaluator.ts';
import { parkingLot } from '../src/problems/parking-lot.ts';

/** Notes where every section is long enough to pass the structure checks. */
export const FULL_NOTES: NoteSections = {
  requirements: 'Park and unpark bikes, cars and trucks across levels; issue tickets; charge at exit. No bookings.',
  entities: 'ParkingLot coordinates levels. Level owns spots. Ticket records entry. PricingStrategy computes fees.',
  flows: 'Entry: gate asks the lot for a spot, the spot is reserved, a ticket is printed. Exit: fee is computed and paid.',
  patterns: 'Strategy for pricing because rules change often; rejected a switch on vehicle type inside ParkingLot.',
  edgeCases: 'When the lot is full the gate refuses entry. Two gates reserving one spot: spot reservation is atomic.',
};

export function content(notes: NoteSections, diagram?: string): SubmissionContent {
  return {
    artifacts: [
      { kind: 'design-notes', sections: notes },
      ...(diagram === undefined ? [] : [{ kind: 'class-diagram' as const, format: 'mermaid' as const, source: diagram }]),
    ],
  };
}

export function contextFor(options: {
  diagram?: string;
  notes?: NoteSections;
  problem?: Problem;
  withTwist?: boolean;
}): EvaluationContext {
  const problem = options.problem ?? parkingLot;
  return {
    problem,
    analysis: new SubmissionAnalyzer().analyze(content(options.notes ?? FULL_NOTES, options.diagram)),
    findings: [],
    ...(options.withTwist ? { twist: problem.twist } : {}),
  };
}

/** A Parking Lot diagram that covers every concept and abstracts every variation point. */
export const COMPLETE_LOT = `classDiagram
  class ParkingLot
  class Level
  class ParkingSpot
  class Vehicle
  class Ticket
  class Payment
  class PricingStrategy {
    <<interface>>
    +price(Ticket t) Money
  }
  class SpotAllocationStrategy {
    <<interface>>
  }
  class PaymentMethod {
    <<interface>>
  }
  ParkingLot *-- Level
  Level *-- ParkingSpot
  ParkingLot --> PricingStrategy
  ParkingLot --> SpotAllocationStrategy
  Payment --> PaymentMethod`;
