import type { EvaluationStatus, FeedbackReport } from '../../../shared/types.ts';
import { DomainError } from './errors.ts';

export interface EvaluationSnapshot {
  status: EvaluationStatus;
  /** How many times evaluation has been started. Capped so a bad submission cannot loop forever. */
  tries: number;
  /** Bumped on every change. Storage uses it for compare-and-set, so a stale worker cannot overwrite newer state. */
  version: number;
  lockedUntil?: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  report?: FeedbackReport;
}

// The only legal moves. Everything else throws.
const TRANSITIONS: Readonly<Record<EvaluationStatus, readonly EvaluationStatus[]>> = {
  SUBMITTED: ['EVALUATING'],
  EVALUATING: ['COMPLETED', 'FAILED', 'SUBMITTED'],
  COMPLETED: [],
  FAILED: ['SUBMITTED'],
};

export class Evaluation {
  static readonly MAX_TRIES = 3;
  private state: EvaluationSnapshot;

  private constructor(state: EvaluationSnapshot) {
    this.state = state;
  }

  static submitted(): Evaluation {
    return new Evaluation({ status: 'SUBMITTED', tries: 0, version: 0 });
  }

  static fromSnapshot(snapshot: EvaluationSnapshot): Evaluation {
    return new Evaluation({ ...snapshot });
  }

  get status(): EvaluationStatus {
    return this.state.status;
  }

  get tries(): number {
    return this.state.tries;
  }

  get version(): number {
    return this.state.version;
  }

  get report(): FeedbackReport | undefined {
    return this.state.report;
  }

  get canRetry(): boolean {
    return this.state.status === 'FAILED' && this.state.tries < Evaluation.MAX_TRIES;
  }

  /** A worker takes the job and holds a lease on it until `now + leaseMs`. */
  start(now: Date, leaseMs: number): void {
    this.move('EVALUATING');
    this.state.tries += 1;
    this.state.startedAt = now;
    this.state.lockedUntil = new Date(now.getTime() + leaseMs);
    delete this.state.error;
  }

  /** Saves what is known so far (the deterministic findings) while the slow part still runs. */
  recordPartial(report: FeedbackReport): void {
    this.require('EVALUATING', 'record partial feedback');
    this.state.report = report;
    this.state.version += 1;
  }

  complete(report: FeedbackReport, now: Date): void {
    this.move('COMPLETED');
    this.state.report = report;
    this.finish(now);
  }

  /** Keeps whatever partial feedback exists, so a failed AI review never hides the rule findings. */
  fail(error: string, now: Date, partial?: FeedbackReport): void {
    this.move('FAILED');
    this.state.error = error;
    if (partial) this.state.report = partial;
    this.finish(now);
  }

  isLeaseExpired(now: Date): boolean {
    return this.state.status === 'EVALUATING' && (this.state.lockedUntil?.getTime() ?? 0) <= now.getTime();
  }

  /** The worker holding the lease vanished. Queue the job again, or give up after MAX_TRIES. */
  releaseExpiredLease(now: Date): void {
    if (!this.isLeaseExpired(now)) throw new DomainError('conflict', 'The evaluation lease has not expired.');
    if (this.state.tries < Evaluation.MAX_TRIES) {
      this.move('SUBMITTED');
      delete this.state.lockedUntil;
    } else {
      this.fail('Evaluation took too long and was stopped.', now);
    }
  }

  /** The learner asks for another go after a failure. */
  retry(): void {
    if (this.state.status !== 'FAILED') throw new DomainError('conflict', 'Only a failed evaluation can be retried.');
    if (this.state.tries >= Evaluation.MAX_TRIES) {
      throw new DomainError('conflict', `This evaluation already failed ${Evaluation.MAX_TRIES} times.`);
    }
    this.move('SUBMITTED');
    delete this.state.error;
  }

  toSnapshot(): EvaluationSnapshot {
    return { ...this.state };
  }

  private move(to: EvaluationStatus): void {
    const from = this.state.status;
    if (!TRANSITIONS[from].includes(to)) {
      throw new DomainError('conflict', `An evaluation cannot go from ${from} to ${to}.`);
    }
    this.state.status = to;
    this.state.version += 1;
  }

  private require(status: EvaluationStatus, action: string): void {
    if (this.state.status !== status) throw new DomainError('conflict', `Cannot ${action} while ${this.state.status}.`);
  }

  private finish(now: Date): void {
    this.state.completedAt = now;
    delete this.state.lockedUntil;
  }
}
