import { describe, expect, it } from 'vitest';
import { Attempt } from '../../src/domain/attempt.ts';
import { contentHash } from '../../src/domain/submission.ts';
import { parkingLot } from '../../src/problems/parking-lot.ts';
import { vendingMachine } from '../../src/problems/vending-machine.ts';
import { FULL_NOTES, content } from '../helpers.ts';

const NOW = new Date('2026-09-27T10:00:00Z');
const DESIGN = content(FULL_NOTES, 'classDiagram\n  ParkingLot *-- Level');

function newAttempt(): Attempt {
  return Attempt.start({ id: 'a1', learnerId: 'l1', problem: parkingLot, now: NOW });
}

function submit(attempt: Attempt, overrides: Partial<Parameters<Attempt['submit']>[0]> = {}) {
  return attempt.submit({ id: 's1', content: DESIGN, idempotencyKey: 'k1', problem: parkingLot, now: NOW, ...overrides });
}

describe('Attempt', () => {
  it('starts from the problem starter diagram', () => {
    const attempt = newAttempt();
    expect(attempt.draft.artifacts).toContainEqual({
      kind: 'class-diagram',
      format: 'mermaid',
      source: parkingLot.starterDiagram,
    });
  });

  it('numbers versions and keeps the draft in step with the latest submission', () => {
    const attempt = newAttempt();
    const first = submit(attempt);
    expect(first.kind).toBe('created');
    expect(first.submission.version).toBe(1);
    expect(first.submission.evaluation.status).toBe('SUBMITTED');

    const revised = content(FULL_NOTES, 'classDiagram\n  ParkingLot *-- Level\n  Level *-- ParkingSpot');
    const second = submit(attempt, { id: 's2', idempotencyKey: 'k2', content: revised, latest: first.submission });
    expect(second.submission.version).toBe(2);
    expect(attempt.draft).toBe(revised);
  });

  it('returns the latest version instead of creating a copy when nothing changed', () => {
    const attempt = newAttempt();
    const first = submit(attempt).submission;
    const trailingSpaces = content(FULL_NOTES, 'classDiagram   \n  ParkingLot *-- Level  ');

    const again = submit(attempt, { id: 's2', idempotencyKey: 'k2', content: trailingSpaces, latest: first });
    expect(again).toEqual({ kind: 'unchanged', submission: first });
  });

  it('refuses an empty submission', () => {
    expect(() => submit(newAttempt(), { content: content({ requirements: '   ' }) })).toThrow('Write something');
  });

  it('refuses content for a different problem', () => {
    expect(() => submit(newAttempt(), { problem: vendingMachine })).toThrow('different problem');
  });

  it('keeps the twist locked until the first version has been reviewed', () => {
    const attempt = newAttempt();
    const first = submit(attempt).submission;
    const twist = { id: 's2', idempotencyKey: 'k2', twistId: 'ev-charging', latest: first };

    expect(() => submit(attempt, twist)).toThrow('twist unlocks');

    first.evaluation.start(NOW, 1000);
    first.evaluation.complete({ findings: [], criteria: [], strengths: [], evidence: { verified: 0, total: 0 }, ai: { state: 'not-configured' }, runs: [] }, NOW);
    const answered = submit(attempt, twist);
    expect(answered.kind).toBe('created');
    expect(answered.submission.twistId).toBe('ev-charging');
  });

  it('refuses a twist that does not belong to the problem', () => {
    expect(() => submit(newAttempt(), { twistId: 'fire-mode' })).toThrow('Unknown twist');
  });
});

describe('contentHash', () => {
  it('ignores section order, blank sections and trailing spaces', () => {
    const a = content({ requirements: 'Park cars', entities: 'Lot' }, 'classDiagram\n  A --> B');
    const b = content({ entities: 'Lot ', flows: '  ', requirements: 'Park cars' }, 'classDiagram  \n  A --> B\n');
    expect(contentHash(a)).toBe(contentHash(b));
  });

  it('changes when the design changes', () => {
    expect(contentHash(content({ requirements: 'Park cars' }))).not.toBe(contentHash(content({ requirements: 'Park bikes' })));
  });
});
