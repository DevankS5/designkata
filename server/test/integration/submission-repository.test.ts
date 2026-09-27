import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Attempt } from '../../src/domain/attempt.ts';
import type { Submission } from '../../src/domain/submission.ts';
import type { Models } from '../../src/persistence/models.ts';
import { SubmissionRepository } from '../../src/persistence/submission-repository.ts';
import { parkingLot } from '../../src/problems/parking-lot.ts';
import { testDatabase } from '../db.ts';
import { FULL_NOTES, content } from '../helpers.ts';

const NOW = new Date('2026-09-27T10:00:00Z');
let db: Awaited<ReturnType<typeof testDatabase>>;
let models: Models;
let submissions: SubmissionRepository;

beforeAll(async () => {
  db = await testDatabase();
  models = db.models;
  submissions = new SubmissionRepository(models);
});
afterAll(() => db.close());
beforeEach(async () => {
  await models.Submission.deleteMany({});
});

function newSubmission(attempt: Attempt, id: string, key: string, diagram = 'classDiagram\n  ParkingLot *-- Level'): Submission {
  const outcome = attempt.submit({ id, content: content(FULL_NOTES, diagram), idempotencyKey: key, problem: parkingLot, now: NOW });
  return outcome.submission;
}

describe('SubmissionRepository', () => {
  it('stores a submission and its queued evaluation in one write', async () => {
    const attempt = Attempt.start({ id: 'a1', learnerId: 'l1', problem: parkingLot, now: NOW });
    const { created } = await submissions.insert(newSubmission(attempt, 's1', 'k1'));

    expect(created).toBe(true);
    const loaded = await submissions.findById('s1');
    expect(loaded?.evaluation.status).toBe('SUBMITTED');
    expect(loaded?.version).toBe(1);
  });

  it('returns the first submission when the same idempotency key arrives twice', async () => {
    const attempt = Attempt.start({ id: 'a1', learnerId: 'l1', problem: parkingLot, now: NOW });
    await submissions.insert(newSubmission(attempt, 's1', 'same-key'));
    const retry = await submissions.insert(newSubmission(attempt, 's2', 'same-key'));

    expect(retry).toMatchObject({ created: false });
    expect(retry.submission.id).toBe('s1');
    expect(await models.Submission.countDocuments()).toBe(1);
  });

  it('refuses two different submissions racing for the same version', async () => {
    const attempt = Attempt.start({ id: 'a1', learnerId: 'l1', problem: parkingLot, now: NOW });
    await submissions.insert(newSubmission(attempt, 's1', 'k1'));
    await expect(submissions.insert(newSubmission(attempt, 's2', 'k2', 'classDiagram\n  A --> B'))).rejects.toThrow(
      'Another version was saved at the same moment',
    );
  });

  it('writes an evaluation only if nobody changed it first', async () => {
    const attempt = Attempt.start({ id: 'a1', learnerId: 'l1', problem: parkingLot, now: NOW });
    await submissions.insert(newSubmission(attempt, 's1', 'k1'));

    const first = (await submissions.findById('s1'))!;
    const stale = (await submissions.findById('s1'))!;
    first.evaluation.start(NOW, 1000);
    stale.evaluation.start(NOW, 1000);

    expect(await submissions.saveEvaluation(first, 0)).toBe(true);
    expect(await submissions.saveEvaluation(stale, 0)).toBe(false);
  });

  it('gives a queued job to exactly one of two workers claiming at once', async () => {
    const attempt = Attempt.start({ id: 'a1', learnerId: 'l1', problem: parkingLot, now: NOW });
    await submissions.insert(newSubmission(attempt, 's1', 'k1'));

    const claims = await Promise.all([submissions.claimNext(NOW, 60_000), submissions.claimNext(NOW, 60_000)]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect((await submissions.findById('s1'))!.evaluation.status).toBe('EVALUATING');
  });

  it('claims the oldest job first and finds leases that expired', async () => {
    const attempt = Attempt.start({ id: 'a1', learnerId: 'l1', problem: parkingLot, now: NOW });
    const first = newSubmission(attempt, 's1', 'k1');
    await submissions.insert(first);
    const second = attempt.submit({
      id: 's2',
      content: content(FULL_NOTES, 'classDiagram\n  A --> B'),
      idempotencyKey: 'k2',
      problem: parkingLot,
      latest: first,
      now: new Date(NOW.getTime() + 5000),
    }).submission;
    await submissions.insert(second);

    expect((await submissions.claimNext(NOW, 1000))!.id).toBe('s1');
    expect(await submissions.findExpiredLeases(new Date(NOW.getTime() + 999))).toEqual([]);
    expect((await submissions.findExpiredLeases(new Date(NOW.getTime() + 1000))).map((s) => s.id)).toEqual(['s1']);
  });
});
