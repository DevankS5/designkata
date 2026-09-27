import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FeedbackReport } from '../../../shared/types.ts';
import { PracticeService } from '../../src/app/practice-service.ts';
import { RateLimiter } from '../../src/app/rate-limiter.ts';
import { AttemptRepository } from '../../src/persistence/attempt-repository.ts';
import type { Models } from '../../src/persistence/models.ts';
import { SubmissionRepository } from '../../src/persistence/submission-repository.ts';
import { parkingLot } from '../../src/problems/parking-lot.ts';
import { testDatabase } from '../db.ts';
import { COMPLETE_LOT, FULL_NOTES, content } from '../helpers.ts';

const NOW = new Date('2026-09-27T10:00:00Z');
const LEARNER = '11111111-1111-4111-8111-111111111111';
const STRANGER = '22222222-2222-4222-8222-222222222222';

let db: Awaited<ReturnType<typeof testDatabase>>;
let models: Models;
let submissions: SubmissionRepository;
let nudges: number;
let ids: number;
let clock: number;
let practice: PracticeService;

function service(limit = 50): PracticeService {
  return new PracticeService({
    attempts: new AttemptRepository(models),
    submissions,
    worker: { nudge: () => void (nudges += 1) },
    reviewLimiter: new RateLimiter(limit, 60 * 60 * 1000),
    // Time moves forward a second per call, like it does between real requests.
    now: () => new Date(NOW.getTime() + (clock += 1000)),
    newId: () => `id-${(ids += 1)}`,
  });
}

beforeAll(async () => {
  db = await testDatabase();
  models = db.models;
  submissions = new SubmissionRepository(models);
});
afterAll(() => db.close());
beforeEach(async () => {
  await models.Attempt.deleteMany({});
  await models.Submission.deleteMany({});
  nudges = 0;
  ids = 0;
  clock = 0;
  practice = service();
});

const report = (level: 1 | 2 | 3 | 4): FeedbackReport => ({
  findings: [{ ruleId: 'god-class', severity: 'warning', message: 'ParkingLot does too much.', suggestion: 'Split it.' }],
  criteria: [{ criterionId: 'coupling', level, evidence: [], strength: '', concern: '', suggestion: '', confidence: 'high' }],
  strengths: [],
  evidence: { verified: 0, total: 0 },
  ai: { state: 'completed', model: 'test' },
  runs: [],
});

async function complete(submissionId: string, level: 1 | 2 | 3 | 4 = 2): Promise<void> {
  const submission = (await submissions.findById(submissionId))!;
  const version = submission.evaluation.version;
  submission.evaluation.start(NOW, 1000);
  submission.evaluation.complete(report(level), NOW);
  await submissions.saveEvaluation(submission, version);
}

describe('PracticeService', () => {
  it('starts an attempt from the starter diagram and hides it from other learners', async () => {
    const attempt = await practice.startAttempt(LEARNER, 'parking-lot');
    expect(attempt.draft.artifacts[1]).toMatchObject({ source: parkingLot.starterDiagram });
    expect(attempt.twistUnlocked).toBe(false);

    await expect(practice.getAttempt(STRANGER, attempt.id)).rejects.toMatchObject({ code: 'not-found' });
    await expect(practice.startAttempt(LEARNER, 'no-such-problem')).rejects.toMatchObject({ code: 'not-found' });
  });

  it('saves drafts', async () => {
    const attempt = await practice.startAttempt(LEARNER, 'parking-lot');
    await practice.saveDraft(LEARNER, attempt.id, content({ requirements: 'Park cars.' }));
    expect((await practice.getAttempt(LEARNER, attempt.id)).draft).toEqual(content({ requirements: 'Park cars.' }));
  });

  it('queues a review once, however many times the same submit arrives', async () => {
    const attempt = await practice.startAttempt(LEARNER, 'parking-lot');
    const input = { content: content(FULL_NOTES, COMPLETE_LOT), idempotencyKey: 'click-1' };

    const first = await practice.submit(LEARNER, attempt.id, input);
    const again = await practice.submit(LEARNER, attempt.id, input);

    expect(first).toMatchObject({ created: true, submission: { version: 1, evaluation: { status: 'SUBMITTED' } } });
    expect(again).toMatchObject({ created: false, submission: { id: first.submission.id } });
    expect(nudges).toBe(1);
  });

  it('answers an unchanged resubmission with the latest version instead of a new review', async () => {
    const attempt = await practice.startAttempt(LEARNER, 'parking-lot');
    const design = content(FULL_NOTES, COMPLETE_LOT);
    const first = await practice.submit(LEARNER, attempt.id, { content: design, idempotencyKey: 'k1' });
    const same = await practice.submit(LEARNER, attempt.id, { content: design, idempotencyKey: 'k2' });

    expect(same).toMatchObject({ created: false, submission: { id: first.submission.id } });
    expect(nudges).toBe(1);
  });

  it('refuses empty work and a twist before the first review', async () => {
    const attempt = await practice.startAttempt(LEARNER, 'parking-lot');
    await expect(practice.submit(LEARNER, attempt.id, { content: content({}), idempotencyKey: 'k1' })).rejects.toMatchObject({
      code: 'validation',
    });

    await practice.submit(LEARNER, attempt.id, { content: content(FULL_NOTES, COMPLETE_LOT), idempotencyKey: 'k2' });
    await expect(
      practice.submit(LEARNER, attempt.id, {
        content: content({ ...FULL_NOTES, changeAnswer: 'Added EV spots.' }, COMPLETE_LOT),
        idempotencyKey: 'k3',
        twistId: 'ev-charging',
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('unlocks the twist once the latest version is reviewed, and shows level changes', async () => {
    const attempt = await practice.startAttempt(LEARNER, 'parking-lot');
    const v1 = await practice.submit(LEARNER, attempt.id, { content: parkingLot.sample!, idempotencyKey: 'k1' });
    await complete(v1.submission.id, 2);
    expect((await practice.getAttempt(LEARNER, attempt.id)).twistUnlocked).toBe(true);

    const v2 = await practice.submit(LEARNER, attempt.id, {
      content: content({ ...FULL_NOTES, changeAnswer: 'Added an EV spot and a per kWh pricing strategy; nothing else changed.' }, COMPLETE_LOT),
      idempotencyKey: 'k2',
      twistId: 'ev-charging',
    });
    expect(v2.submission).toMatchObject({ version: 2, twistId: 'ev-charging', previousLevels: { coupling: 2 } });
  });

  it('caps reviews across all learners, since the learner id comes from the browser', async () => {
    practice = new PracticeService({
      attempts: new AttemptRepository(models),
      submissions,
      worker: { nudge: () => {} },
      globalLimiter: new RateLimiter(1, 60 * 60 * 1000),
    });
    const mine = await practice.startAttempt(LEARNER, 'parking-lot');
    await practice.submit(LEARNER, mine.id, { content: content(FULL_NOTES, COMPLETE_LOT), idempotencyKey: 'k1' });
    const theirs = await practice.startAttempt(STRANGER, 'parking-lot');
    await expect(
      practice.submit(STRANGER, theirs.id, { content: content(FULL_NOTES, COMPLETE_LOT), idempotencyKey: 'k2' }),
    ).rejects.toMatchObject({ code: 'rate-limited' });
  });

  it('limits reviews per learner per hour', async () => {
    practice = service(1);
    const attempt = await practice.startAttempt(LEARNER, 'parking-lot');
    await practice.submit(LEARNER, attempt.id, { content: content(FULL_NOTES, COMPLETE_LOT), idempotencyKey: 'k1' });
    await expect(
      practice.submit(LEARNER, attempt.id, { content: parkingLot.sample!, idempotencyKey: 'k2' }),
    ).rejects.toMatchObject({ code: 'rate-limited' });
  });

  it('only retries a failed review', async () => {
    const attempt = await practice.startAttempt(LEARNER, 'parking-lot');
    const { submission } = await practice.submit(LEARNER, attempt.id, { content: content(FULL_NOTES, COMPLETE_LOT), idempotencyKey: 'k1' });
    await expect(practice.retry(LEARNER, submission.id)).rejects.toMatchObject({ code: 'conflict' });

    const stored = (await submissions.findById(submission.id))!;
    const version = stored.evaluation.version;
    stored.evaluation.start(NOW, 1000);
    stored.evaluation.fail('provider down', NOW);
    await submissions.saveEvaluation(stored, version);

    const retried = await practice.retry(LEARNER, submission.id);
    expect(retried.evaluation.status).toBe('SUBMITTED');
    expect(nudges).toBe(2);
    await expect(practice.retry(STRANGER, submission.id)).rejects.toMatchObject({ code: 'not-found' });
  });

  it('checks the structure of a draft without saving anything', async () => {
    const findings = practice.checkStructure('parking-lot', parkingLot.sample!);
    expect(findings.map((f) => f.ruleId)).toContain('god-class');
    expect(await models.Submission.countDocuments()).toBe(0);
  });

  it('shows progress: history per attempt and the weaknesses that keep coming back', async () => {
    const first = await practice.startAttempt(LEARNER, 'parking-lot');
    const a = await practice.submit(LEARNER, first.id, { content: parkingLot.sample!, idempotencyKey: 'k1' });
    const second = await practice.startAttempt(LEARNER, 'parking-lot');
    const b = await practice.submit(LEARNER, second.id, { content: content(FULL_NOTES, COMPLETE_LOT), idempotencyKey: 'k2' });
    await complete(a.submission.id, 1);
    await complete(b.submission.id, 2);

    const progress = await practice.progress(LEARNER);
    expect(progress.reviewed).toBe(2);
    expect(progress.weaknesses).toEqual([{ criterionId: 'coupling', lowCount: 2, outOf: 2, averageLevel: 1.5 }]);
    expect(progress.recurringFindings[0]).toMatchObject({ ruleId: 'god-class', count: 2 });
    expect(progress.history.map((h) => h.versions.length)).toEqual([1, 1]);

    const problems = await practice.listProblems(LEARNER);
    expect(problems.find((p) => p.slug === 'parking-lot')).toMatchObject({ attempts: 2, latestLevels: { coupling: 2 } });
    expect((await practice.listProblems()).every((p) => p.attempts === 0)).toBe(true);
  });
});
