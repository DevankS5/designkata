import { describe, expect, it } from 'vitest';
import type { FeedbackReport } from '../../../shared/types.ts';
import { Evaluation } from '../../src/domain/evaluation.ts';

const NOW = new Date('2026-09-27T10:00:00Z');
const later = (ms: number) => new Date(NOW.getTime() + ms);
const report = (findings = 0): FeedbackReport => ({
  findings: Array.from({ length: findings }, () => ({ ruleId: 'r', severity: 'info' as const, message: 'm', suggestion: 's' })),
  criteria: [],
  strengths: [],
  evidence: { verified: 0, total: 0 },
  ai: { state: 'not-configured' },
  runs: [],
});

describe('Evaluation state machine', () => {
  it('walks the happy path and bumps the version on every change', () => {
    const evaluation = Evaluation.submitted();
    evaluation.start(NOW, 60_000);
    expect(evaluation.status).toBe('EVALUATING');
    expect(evaluation.toSnapshot().lockedUntil).toEqual(later(60_000));

    evaluation.recordPartial(report(2));
    evaluation.complete(report(3), later(5_000));

    expect(evaluation.status).toBe('COMPLETED');
    expect(evaluation.report!.findings).toHaveLength(3);
    expect(evaluation.version).toBe(3);
    expect(evaluation.toSnapshot().lockedUntil).toBeUndefined();
  });

  it.each([
    ['complete a submission nobody started', (e: Evaluation) => e.complete(report(), NOW)],
    ['fail a submission nobody started', (e: Evaluation) => e.fail('x', NOW)],
    ['record partial feedback before starting', (e: Evaluation) => e.recordPartial(report())],
  ])('refuses to %s', (_name, act) => {
    expect(() => act(Evaluation.submitted())).toThrow();
  });

  it('never leaves COMPLETED', () => {
    const evaluation = Evaluation.submitted();
    evaluation.start(NOW, 1000);
    evaluation.complete(report(), NOW);

    expect(() => evaluation.start(NOW, 1000)).toThrow('cannot go from COMPLETED to EVALUATING');
    expect(() => evaluation.retry()).toThrow('Only a failed evaluation can be retried');
  });

  it('keeps partial feedback when it fails', () => {
    const evaluation = Evaluation.submitted();
    evaluation.start(NOW, 1000);
    evaluation.fail('AI review timed out', NOW, report(2));

    expect(evaluation.status).toBe('FAILED');
    expect(evaluation.report!.findings).toHaveLength(2);
    expect(evaluation.toSnapshot().error).toBe('AI review timed out');
  });

  it('lets the learner retry until the try limit, then says no', () => {
    const evaluation = Evaluation.submitted();
    for (let attempt = 1; attempt <= Evaluation.MAX_TRIES; attempt += 1) {
      evaluation.start(NOW, 1000);
      evaluation.fail('down', NOW);
      if (attempt < Evaluation.MAX_TRIES) {
        expect(evaluation.canRetry).toBe(true);
        evaluation.retry();
      }
    }
    expect(evaluation.canRetry).toBe(false);
    expect(() => evaluation.retry()).toThrow('already failed 3 times');
  });

  it('requeues a job whose worker disappeared, and gives up after the try limit', () => {
    const evaluation = Evaluation.submitted();
    evaluation.start(NOW, 1000);
    expect(evaluation.isLeaseExpired(later(999))).toBe(false);
    expect(() => evaluation.releaseExpiredLease(later(999))).toThrow();

    evaluation.releaseExpiredLease(later(1000));
    expect(evaluation.status).toBe('SUBMITTED');

    evaluation.start(later(2000), 1000);
    evaluation.releaseExpiredLease(later(5000));
    evaluation.start(later(6000), 1000);
    evaluation.releaseExpiredLease(later(9000));

    expect(evaluation.status).toBe('FAILED');
    expect(evaluation.toSnapshot().error).toContain('took too long');
  });

  it('round-trips through a snapshot without sharing state', () => {
    const original = Evaluation.submitted();
    original.start(NOW, 1000);
    const copy = Evaluation.fromSnapshot(original.toSnapshot());
    copy.complete(report(), NOW);

    expect(original.status).toBe('EVALUATING');
    expect(copy.status).toBe('COMPLETED');
  });
});
