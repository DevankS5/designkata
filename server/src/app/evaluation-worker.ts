import type { Submission } from '../domain/submission.ts';
import { EvaluationFailure } from '../evaluation/pipeline.ts';
import type { SubmissionRepository } from '../persistence/submission-repository.ts';
import type { SubmissionEvaluator } from './submission-evaluator.ts';

export interface WorkerOptions {
  /** How long a claimed job belongs to this worker before others may take it back. */
  leaseMs: number;
  pollMs: number;
  concurrency: number;
  now?: () => Date;
  log?: (message: string) => void;
}

/** Another worker took the job over (our lease expired). Our result must not be written. */
class LostLease extends Error {}

/**
 * Picks queued evaluations from MongoDB and runs them in this process. The
 * request that created a submission never waits for it. If this process dies
 * mid-evaluation, the lease expires and the job is picked up again.
 */
export class EvaluationWorker {
  private readonly submissions: SubmissionRepository;
  private readonly evaluator: SubmissionEvaluator;
  private readonly options: Required<Omit<WorkerOptions, 'log'>> & Pick<WorkerOptions, 'log'>;
  private readonly inFlight = new Set<Promise<void>>();
  private timer: NodeJS.Timeout | undefined;
  private running: Promise<void> | undefined;
  private tickAgain = false;

  constructor(submissions: SubmissionRepository, evaluator: SubmissionEvaluator, options: WorkerOptions) {
    this.submissions = submissions;
    this.evaluator = evaluator;
    this.options = { now: () => new Date(), ...options };
  }

  start(): void {
    this.timer = setInterval(() => this.nudge(), this.options.pollMs);
    this.nudge();
  }

  async stop(): Promise<void> {
    clearInterval(this.timer);
    await this.drain();
  }

  /** Look for work now instead of waiting for the next poll. Called right after a submission. */
  nudge(): void {
    void this.tick().catch((error: unknown) => this.options.log?.(`worker tick failed: ${String(error)}`));
  }

  /**
   * One pass: give back expired leases, then claim jobs up to the concurrency
   * limit. Only one pass runs at a time; a nudge during a pass asks for another.
   */
  tick(): Promise<void> {
    if (this.running) {
      this.tickAgain = true;
      return this.running;
    }
    this.running = this.pass().finally(() => {
      this.running = undefined;
    });
    return this.running;
  }

  /** Resolves when no pass is running and every claimed evaluation has finished. */
  async drain(): Promise<void> {
    while (this.running || this.inFlight.size > 0) {
      await Promise.allSettled([...this.inFlight, ...(this.running ? [this.running] : [])]);
    }
  }

  private async pass(): Promise<void> {
    do {
      this.tickAgain = false;
      await this.recoverExpiredLeases();
      while (this.inFlight.size < this.options.concurrency) {
        const job = await this.submissions.claimNext(this.options.now(), this.options.leaseMs);
        if (!job) break;
        this.track(this.process(job));
      }
    } while (this.tickAgain);
  }

  private track(job: Promise<void>): void {
    this.inFlight.add(job);
    void job.finally(() => {
      this.inFlight.delete(job);
      this.nudge();
    });
  }

  private async process(submission: Submission): Promise<void> {
    const evaluation = submission.evaluation;
    let savedVersion = evaluation.version;
    const save = async () => {
      if (!(await this.submissions.saveEvaluation(submission, savedVersion))) throw new LostLease();
      savedVersion = evaluation.version;
    };

    try {
      const report = await this.evaluator.evaluate(submission, async (partial) => {
        evaluation.recordPartial(partial);
        await save();
      });
      evaluation.complete(report, this.options.now());
      await save();
    } catch (error) {
      if (error instanceof LostLease) {
        this.options.log?.(`evaluation ${submission.id}: lease lost, result discarded`);
        return;
      }
      const partial = error instanceof EvaluationFailure ? error.partial : evaluation.report;
      this.options.log?.(`evaluation ${submission.id} failed: ${error instanceof Error ? error.message : String(error)}`);
      try {
        evaluation.fail(error instanceof Error ? error.message : 'Evaluation failed.', this.options.now(), partial);
        await save();
      } catch {
        // Lost the lease while failing: whoever holds it now owns the outcome.
      }
    }
  }

  private async recoverExpiredLeases(): Promise<void> {
    const now = this.options.now();
    for (const submission of await this.submissions.findExpiredLeases(now)) {
      const expected = submission.evaluation.version;
      submission.evaluation.releaseExpiredLease(now);
      await this.submissions.saveEvaluation(submission, expected);
    }
  }
}
