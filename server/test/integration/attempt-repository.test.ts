import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Attempt } from '../../src/domain/attempt.ts';
import { AttemptRepository } from '../../src/persistence/attempt-repository.ts';
import type { Models } from '../../src/persistence/models.ts';
import { parkingLot } from '../../src/problems/parking-lot.ts';
import { testDatabase } from '../db.ts';

const NOW = new Date('2026-09-27T10:00:00Z');
let db: Awaited<ReturnType<typeof testDatabase>>;
let models: Models;
let attempts: AttemptRepository;

beforeAll(async () => {
  db = await testDatabase();
  models = db.models;
  attempts = new AttemptRepository(models);
});
afterAll(() => db.close());
beforeEach(async () => {
  await models.Attempt.deleteMany({});
});

describe('AttemptRepository', () => {
  it('round-trips an attempt, including an empty notes section', async () => {
    const attempt = Attempt.start({ id: 'a1', learnerId: 'l1', problem: parkingLot, now: NOW });
    await attempts.save(attempt);

    const loaded = await attempts.findById('a1');
    expect(loaded?.toSnapshot()).toEqual(attempt.toSnapshot());
    expect(loaded?.draft.artifacts[0]).toEqual({ kind: 'design-notes', sections: {} });
  });

  it('lists a learner attempts newest first, optionally for one problem', async () => {
    await attempts.save(Attempt.start({ id: 'old', learnerId: 'l1', problem: parkingLot, now: NOW }));
    await attempts.save(Attempt.start({ id: 'new', learnerId: 'l1', problem: parkingLot, now: new Date(NOW.getTime() + 1000) }));
    await attempts.save(Attempt.start({ id: 'other', learnerId: 'l2', problem: parkingLot, now: NOW }));

    expect((await attempts.listForLearner('l1')).map((a) => a.id)).toEqual(['new', 'old']);
    expect(await attempts.listForLearner('l1', 'elevator')).toEqual([]);
  });
});
