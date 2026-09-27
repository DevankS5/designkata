import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AttemptDto, SubmissionDto } from '../../../shared/types.ts';
import { EvaluationWorker } from '../../src/app/evaluation-worker.ts';
import { PracticeService } from '../../src/app/practice-service.ts';
import { SubmissionEvaluator } from '../../src/app/submission-evaluator.ts';
import { LlmRubricEvaluator } from '../../src/evaluation/llm-rubric-evaluator.ts';
import { EvaluationPipeline } from '../../src/evaluation/pipeline.ts';
import { RuleBasedEvaluator } from '../../src/evaluation/rule-evaluator.ts';
import { createApp } from '../../src/http/app.ts';
import { FakeLlmClient } from '../../src/llm/fake-llm-client.ts';
import { AttemptRepository } from '../../src/persistence/attempt-repository.ts';
import type { Models } from '../../src/persistence/models.ts';
import { SubmissionRepository } from '../../src/persistence/submission-repository.ts';
import { parkingLot } from '../../src/problems/parking-lot.ts';
import { testDatabase } from '../db.ts';
import { COMPLETE_LOT, FULL_NOTES, content, reviewAnswerJson } from '../helpers.ts';

const LEARNER = '11111111-1111-4111-8111-111111111111';
const STRANGER = '22222222-2222-4222-8222-222222222222';

let db: Awaited<ReturnType<typeof testDatabase>>;
let models: Models;
let llm: FakeLlmClient;
let worker: EvaluationWorker;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  db = await testDatabase();
  models = db.models;
});
afterAll(() => db.close());

beforeEach(async () => {
  await models.Attempt.deleteMany({});
  await models.Submission.deleteMany({});
  llm = new FakeLlmClient();
  const submissions = new SubmissionRepository(models);
  const pipeline = new EvaluationPipeline([new RuleBasedEvaluator(), new LlmRubricEvaluator(llm)]);
  worker = new EvaluationWorker(submissions, new SubmissionEvaluator(submissions, pipeline), {
    leaseMs: 60_000,
    pollMs: 60_000,
    concurrency: 2,
  });
  const practice = new PracticeService({ attempts: new AttemptRepository(models), submissions, worker });
  app = createApp({
    practice,
    health: () => ({ ok: true, ai: { enabled: true, model: llm.model }, database: 'test' }),
    log: () => {},
  });
});

const as = (learner: string) => ({
  get: (url: string) => request(app).get(url).set('X-Learner-Id', learner),
  post: (url: string) => request(app).post(url).set('X-Learner-Id', learner),
  put: (url: string) => request(app).put(url).set('X-Learner-Id', learner),
});

async function startAttempt(): Promise<AttemptDto> {
  const response = await as(LEARNER).post('/api/attempts').send({ problemSlug: 'parking-lot' }).expect(201);
  return response.body as AttemptDto;
}

function submit(attemptId: string, key: string, body: object = { content: content(FULL_NOTES, COMPLETE_LOT) }) {
  return as(LEARNER).post(`/api/attempts/${attemptId}/submissions`).set('Idempotency-Key', key).send(body);
}

describe('HTTP API', () => {
  it('reports health and lists problems without a learner id', async () => {
    await request(app).get('/api/health').expect(200, { ok: true, ai: { enabled: true, model: 'fake-model' }, database: 'test' });
    const problems = await request(app).get('/api/problems').expect(200);
    expect(problems.body.map((p: { slug: string }) => p.slug)).toContain('parking-lot');
    await request(app).get('/api/problems/nope').expect(404);
    await request(app).get('/api/nothing-here').expect(404);
  });

  it('runs the whole loop: start, draft, submit, review, progress', async () => {
    llm.queue(reviewAnswerJson(3));
    const attempt = await startAttempt();
    await as(LEARNER).put(`/api/attempts/${attempt.id}/draft`).send({ content: content({ requirements: 'Park cars.' }) }).expect(204);

    const queued = await submit(attempt.id, 'first-click-1').expect(202);
    expect((queued.body as SubmissionDto).evaluation.status).toBe('SUBMITTED');

    await worker.tick();
    await worker.drain();

    const reviewed = (await as(LEARNER).get(`/api/submissions/${queued.body.id}`).expect(200)).body as SubmissionDto;
    expect(reviewed.evaluation.status).toBe('COMPLETED');
    expect(reviewed.evaluation.report?.criteria).toHaveLength(6);
    expect(reviewed.evaluation.report?.evidence).toEqual({ verified: 6, total: 6 });

    const reloaded = (await as(LEARNER).get(`/api/attempts/${attempt.id}`).expect(200)).body as AttemptDto;
    expect(reloaded.twistUnlocked).toBe(true);
    expect(reloaded.submissions[0]!.levels.coupling).toBe(3);

    const progress = await as(LEARNER).get('/api/progress').expect(200);
    expect(progress.body.reviewed).toBe(1);
  });

  it('stores a double-clicked submit once', async () => {
    const attempt = await startAttempt();
    const first = await submit(attempt.id, 'double-click').expect(202);
    const second = await submit(attempt.id, 'double-click').expect(200);
    expect(second.body.id).toBe(first.body.id);
    expect(await models.Submission.countDocuments()).toBe(1);
  });

  it('keeps rule findings when the AI review fails, and retries on request', async () => {
    llm.queue(new Error('provider down'), reviewAnswerJson());
    const attempt = await startAttempt();
    const queued = await submit(attempt.id, 'sample-1', { content: parkingLot.sample! }).expect(202);
    await worker.tick();
    await worker.drain();

    const failed = (await as(LEARNER).get(`/api/submissions/${queued.body.id}`)).body as SubmissionDto;
    expect(failed.evaluation).toMatchObject({ status: 'FAILED', canRetry: true, error: 'provider down' });
    expect(failed.evaluation.report?.findings.length).toBeGreaterThan(0);

    await as(LEARNER).post(`/api/submissions/${queued.body.id}/retry`).expect(202);
    await worker.tick();
    await worker.drain();
    const retried = (await as(LEARNER).get(`/api/submissions/${queued.body.id}`)).body as SubmissionDto;
    expect(retried.evaluation.status).toBe('COMPLETED');
    await as(LEARNER).post(`/api/submissions/${queued.body.id}/retry`).expect(409);
  });

  it('checks a draft without storing anything', async () => {
    const response = await request(app).post('/api/problems/parking-lot/check').send({ content: parkingLot.sample }).expect(200);
    expect(response.body.findings.map((f: { ruleId: string }) => f.ruleId)).toContain('god-class');
    expect(await models.Submission.countDocuments()).toBe(0);
  });

  describe('rejects bad requests with a clear message', () => {
    it('needs a learner id', async () => {
      const response = await request(app).post('/api/attempts').send({ problemSlug: 'parking-lot' }).expect(400);
      expect(response.body.error.message).toContain('X-Learner-Id');
    });

    it('needs an idempotency key to submit', async () => {
      const attempt = await startAttempt();
      const response = await as(LEARNER)
        .post(`/api/attempts/${attempt.id}/submissions`)
        .send({ content: content(FULL_NOTES) })
        .expect(400);
      expect(response.body.error.message).toContain('Idempotency-Key');
    });

    it('refuses sections it does not know and oversized text', async () => {
      const attempt = await startAttempt();
      const unknown = await submit(attempt.id, 'unknown-1', {
        content: { artifacts: [{ kind: 'design-notes', sections: { poem: 'hi' } }] },
      }).expect(400);
      expect(unknown.body.error.code).toBe('validation');

      const long = await submit(attempt.id, 'long-text-1', { content: content({ requirements: 'x'.repeat(6_001) }) }).expect(400);
      expect(long.body.error.message).toContain('6000 characters');
    });

    it('answers 413 for a body over the size limit and 400 for broken JSON', async () => {
      const attempt = await startAttempt();
      await submit(attempt.id, 'huge-body-1', { content: content({ requirements: 'x'.repeat(300_000) }) }).expect(413);
      await as(LEARNER).post('/api/attempts').set('Content-Type', 'application/json').send('{"problemSlug":').expect(400);
    });

    it("hides other learners' work", async () => {
      const attempt = await startAttempt();
      const queued = await submit(attempt.id, 'mine-first-1').expect(202);
      await as(STRANGER).get(`/api/attempts/${attempt.id}`).expect(404);
      await as(STRANGER).get(`/api/submissions/${queued.body.id}`).expect(404);
    });
  });
});
