import { describe, expect, it } from 'vitest';
import { LlmRubricEvaluator, type ReviewAnswer } from '../../src/evaluation/llm-rubric-evaluator.ts';
import { FakeLlmClient } from '../../src/llm/fake-llm-client.ts';
import { COMPLETE_LOT, contextFor } from '../helpers.ts';

const judgment = (level: number, evidence: string[] = []) => ({
  evidence,
  strength: 'Clear.',
  concern: 'None.',
  level,
  suggestion: 'Keep going.',
  confidence: 'high' as const,
});

function answer(overrides: Partial<ReviewAnswer['criteria']> = {}): ReviewAnswer {
  return {
    criteria: {
      requirements: judgment(3, ['issue tickets; charge at exit']),
      responsibilities: judgment(3, ['Level owns spots', 'Gate manages the whole lot']),
      coupling: judgment(2),
      extensibility: judgment(4, ['PricingStrategy']),
      behaviour: judgment(3),
      tradeoffs: judgment(2),
      ...overrides,
    },
    strengths: [`Pricing is behind an interface ${String.fromCodePoint(0x2014)} nice.`],
    summary: 'A solid first design.',
    nextFocus: { criterionId: 'coupling', action: 'Make ParkingLot depend on SpotAllocationStrategy only.' },
  };
}

describe('LlmRubricEvaluator', () => {
  it('returns one judgment per criterion in rubric order, with each quote checked', async () => {
    const llm = new FakeLlmClient([JSON.stringify(answer())]);
    const result = await new LlmRubricEvaluator(llm).evaluate(contextFor({ diagram: COMPLETE_LOT }));

    expect(result.criteria!.map((c) => c.criterionId)).toEqual([
      'requirements',
      'responsibilities',
      'coupling',
      'extensibility',
      'behaviour',
      'tradeoffs',
    ]);
    expect(result.criteria![1]!.evidence).toEqual([
      { quote: 'Level owns spots', verified: true },
      { quote: 'Gate manages the whole lot', verified: false },
    ]);
    expect(result.evidence).toEqual({ verified: 3, total: 4 });
    expect(result.reviewer).toBe('fake-model');
  });

  it('drops confidence to low when none of a criterion\'s quotes can be found', async () => {
    const llm = new FakeLlmClient([JSON.stringify(answer({ coupling: judgment(4, ['ParkingAttendant owns everything']) }))]);
    const result = await new LlmRubricEvaluator(llm).evaluate(contextFor({ diagram: COMPLETE_LOT }));
    expect(result.criteria!.find((c) => c.criterionId === 'coupling')!.confidence).toBe('low');
  });

  it('removes em dashes from what the model wrote', async () => {
    const llm = new FakeLlmClient([JSON.stringify(answer())]);
    const result = await new LlmRubricEvaluator(llm).evaluate(contextFor({ diagram: COMPLETE_LOT }));
    expect(result.strengths).toEqual(['Pricing is behind an interface, nice.']);
  });

  it('asks for a repair when a criterion is missing, then accepts the fixed answer', async () => {
    const broken = answer() as unknown as { criteria: Record<string, unknown> };
    delete broken.criteria.tradeoffs;
    const llm = new FakeLlmClient([JSON.stringify(broken), JSON.stringify(answer())]);

    const result = await new LlmRubricEvaluator(llm).evaluate(contextFor({ diagram: COMPLETE_LOT }));
    expect(result.criteria).toHaveLength(6);
    expect(llm.requests[1]!.messages.at(-1)!.content).toContain('tradeoffs');
  });
});
