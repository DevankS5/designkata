import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { EvaluationWorker, type WorkerOptions } from '../../src/app/evaluation-worker.ts';
import { SubmissionEvaluator } from '../../src/app/submission-evaluator.ts';
import { Attempt } from '../../src/domain/attempt.ts';
import type { Submission } from '../../src/domain/submission.ts';
import type { Evaluator } from '../../src/evaluation/evaluator.ts';
import { LlmRubricEvaluator } from '../../src/evaluation/llm-rubric-evaluator.ts';
import { EvaluationPipeline } from '../../src/evaluation/pipeline.ts';
import { RuleBasedEvaluator } from '../../src/evaluation/rule-evaluator.ts';
import { FakeLlmClient } from '../../src/llm/fake-llm-client.ts';
import type { LlmClient } from '../../src/llm/llm-client.ts';
import type { Models } from '../../src/persistence/models.ts';
import { SubmissionRepository } from '../../src/persistence/submission-repository.ts';
import { parkingLot } from '../../src/problems/parking-lot.ts';
import { testDatabase } from '../db.ts';
import { COMPLETE_LOT, FULL_NOTES, content, reviewAnswerJson } from '../helpers.ts';

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
beforeEach(() => models.Submission.deleteMany({}));

function worker(evaluators: Evaluator[], options: Partial<WorkerOptions> = {}): EvaluationWorker {
  const evaluator = new SubmissionEvaluator(submissions, new EvaluationPipeline(evaluators));
  return new EvaluationWorker(submissions, evaluator, { leaseMs: 60_000, pollMs: 60_000, concurrency: 2, now: () => NOW, ...options });
}

async function queue(id: string, design = content(FULL_NOTES, COMPLETE_LOT), attemptId = `attempt-${id}`): Promise<Submission> {
  const attempt = Attempt.start({ id: attemptId, learnerId: 'l1', problem: parkingLot, now: NOW });
  const { submission } = attempt.submit({ id, content: design, idempotencyKey: `key-${id}`, problem: parkingLot, now: NOW });
  await submissions.insert(submission);
  return submission;
}

async function runOnce(w: EvaluationWorker): Promise<void> {
  await w.tick();
  await w.drain();
}

const load = async (id: string) => (await submissions.findById(id))!;

describe('EvaluationWorker', () => {
  it('completes a rules-only evaluation', async () => {
    await queue('s1');
    await runOnce(worker([new RuleBasedEvaluator()]));

    const { evaluation } = await load('s1');
    expect(evaluation.status).toBe('COMPLETED');
    expect(evaluation.report?.ai).toEqual({ state: 'not-configured' });
    expect(evaluation.report?.runs.map((r) => r.evaluator)).toEqual(['rules']);
  });

  it('saves the rule findings before the reviewer answers', async () => {
    await queue('s1', parkingLot.sample!);
    let duringReview: Submission | undefined;
    const llm: LlmClient = {
      model: 'test/model',
      complete: async () => {
        duringReview = await load('s1');
        return reviewAnswerJson();
      },
    };

    await runOnce(worker([new RuleBasedEvaluator(), new LlmRubricEvaluator(llm)]));

    expect(duringReview!.evaluation.status).toBe('EVALUATING');
    expect(duringReview!.evaluation.report?.ai.state).toBe('pending');
    expect(duringReview!.evaluation.report?.findings.length).toBeGreaterThan(0);

    const { evaluation } = await load('s1');
    expect(evaluation.status).toBe('COMPLETED');
    expect(evaluation.report?.criteria).toHaveLength(6);
    expect(evaluation.report?.ai).toEqual({ state: 'completed', model: 'test/model' });
  });

  it('keeps the rule findings when the review fails, and a retry then succeeds', async () => {
    await queue('s1', parkingLot.sample!);
    const llm = new FakeLlmClient([new Error('provider down'), reviewAnswerJson()]);
    const w = worker([new RuleBasedEvaluator(), new LlmRubricEvaluator(llm)]);

    await runOnce(w);
    const failed = await load('s1');
    expect(failed.evaluation.status).toBe('FAILED');
    expect(failed.evaluation.toSnapshot().error).toBe('provider down');
    expect(failed.evaluation.report?.ai.state).toBe('failed');
    expect(failed.evaluation.report?.findings.length).toBeGreaterThan(0);

    const version = failed.evaluation.version;
    failed.evaluation.retry();
    expect(await submissions.saveEvaluation(failed, version)).toBe(true);
    await runOnce(w);

    const retried = await load('s1');
    expect(retried.evaluation.status).toBe('COMPLETED');
    expect(retried.evaluation.tries).toBe(2);
  });

  it('picks up a job whose worker died, once its lease has expired', async () => {
    await queue('s1');
    await submissions.claimNext(NOW, 1_000);

    await runOnce(worker([new RuleBasedEvaluator()], { now: () => new Date(NOW.getTime() + 500) }));
    expect((await load('s1')).evaluation.status).toBe('EVALUATING');

    await runOnce(worker([new RuleBasedEvaluator()], { now: () => new Date(NOW.getTime() + 2_000) }));
    const { evaluation } = await load('s1');
    expect(evaluation.status).toBe('COMPLETED');
    expect(evaluation.tries).toBe(2);
  });

  it('throws away the result of a worker whose job was taken over', async () => {
    await queue('s1');
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const slow: Evaluator = {
      name: 'slow',
      kind: 'deterministic',
      evaluate: async () => {
        await gate;
        return { findings: [] };
      },
    };

    const w = worker([slow]);
    await w.tick();
    // Meanwhile another worker took the job over and moved it on.
    await models.Submission.updateOne({ _id: 's1' }, { $inc: { 'evaluation.version': 5 } });
    release();
    await w.drain();

    expect((await load('s1')).evaluation.status).toBe('EVALUATING');
  });

  it('never runs more jobs at once than its concurrency limit', async () => {
    await Promise.all(['s1', 's2', 's3'].map((id) => queue(id)));
    let running = 0;
    let peak = 0;
    const counting: Evaluator = {
      name: 'counting',
      kind: 'deterministic',
      evaluate: async () => {
        running += 1;
        peak = Math.max(peak, running);
        await new Promise((resolve) => setTimeout(resolve, 20));
        running -= 1;
        return { findings: [] };
      },
    };

    const w = worker([counting], { concurrency: 2 });
    await w.tick();
    await w.drain();

    const statuses = await Promise.all(['s1', 's2', 's3'].map(async (id) => (await load(id)).evaluation.status));
    expect(statuses).toEqual(['COMPLETED', 'COMPLETED', 'COMPLETED']);
    expect(peak).toBe(2);
  });

  it('reports what changed since the previous version', async () => {
    const attempt = Attempt.start({ id: 'a1', learnerId: 'l1', problem: parkingLot, now: NOW });
    const first = attempt.submit({ id: 's1', content: parkingLot.sample!, idempotencyKey: 'k1', problem: parkingLot, now: NOW });
    await submissions.insert(first.submission);
    const second = attempt.submit({
      id: 's2',
      content: content(FULL_NOTES, COMPLETE_LOT),
      idempotencyKey: 'k2',
      problem: parkingLot,
      latest: first.submission,
      now: NOW,
    });
    await submissions.insert(second.submission);

    await runOnce(worker([new RuleBasedEvaluator()]));

    expect((await load('s1')).evaluation.report?.changeImpact).toBeUndefined();
    const impact = (await load('s2')).evaluation.report?.changeImpact;
    expect(impact?.addedClasses).toContain('PricingStrategy');
    expect(impact?.blastRadius).toBeGreaterThan(0);
  });
});
