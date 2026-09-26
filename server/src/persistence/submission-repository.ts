import { DomainError } from '../domain/errors.ts';
import { Submission, type SubmissionSnapshot } from '../domain/submission.ts';
import type { Models, SubmissionDoc } from './models.ts';

const DUPLICATE_KEY = 11000;

export class SubmissionRepository {
  private readonly models: Models;

  constructor(models: Models) {
    this.models = models;
  }

  /**
   * Stores a new submission with its evaluation queued. If the same
   * idempotency key was already used for this attempt (a double click or a
   * network retry), the earlier submission is returned instead.
   */
  async insert(submission: Submission): Promise<{ submission: Submission; created: boolean }> {
    const { id, ...rest } = submission.toSnapshot();
    try {
      await this.models.Submission.create({ _id: id, ...rest });
      return { submission, created: true };
    } catch (error) {
      if ((error as { code?: number }).code !== DUPLICATE_KEY) throw error;
      const existing = await this.findByIdempotencyKey(submission.attemptId, submission.idempotencyKey);
      if (existing) return { submission: existing, created: false };
      throw new DomainError('conflict', 'Another version was saved at the same moment. Submit again.');
    }
  }

  async findById(id: string): Promise<Submission | undefined> {
    const doc = await this.models.Submission.findById(id).lean<SubmissionDoc>();
    return doc ? toSubmission(doc) : undefined;
  }

  async findByIdempotencyKey(attemptId: string, idempotencyKey: string): Promise<Submission | undefined> {
    const doc = await this.models.Submission.findOne({ attemptId, idempotencyKey }).lean<SubmissionDoc>();
    return doc ? toSubmission(doc) : undefined;
  }

  async findLatest(attemptId: string): Promise<Submission | undefined> {
    const doc = await this.models.Submission.findOne({ attemptId }).sort({ version: -1 }).lean<SubmissionDoc>();
    return doc ? toSubmission(doc) : undefined;
  }

  async findVersion(attemptId: string, version: number): Promise<Submission | undefined> {
    const doc = await this.models.Submission.findOne({ attemptId, version }).lean<SubmissionDoc>();
    return doc ? toSubmission(doc) : undefined;
  }

  async listForAttempt(attemptId: string): Promise<Submission[]> {
    const docs = await this.models.Submission.find({ attemptId }).sort({ version: 1 }).lean<SubmissionDoc[]>();
    return docs.map(toSubmission);
  }

  async listForLearner(learnerId: string): Promise<Submission[]> {
    const docs = await this.models.Submission.find({ learnerId }).sort({ createdAt: 1 }).lean<SubmissionDoc[]>();
    return docs.map(toSubmission);
  }

  /**
   * Compare-and-set: writes the evaluation only if nobody changed it since
   * `expectedVersion`. False means another worker got there first, or a slow
   * worker is trying to write over a newer state.
   */
  async saveEvaluation(submission: Submission, expectedVersion: number): Promise<boolean> {
    const result = await this.models.Submission.updateOne(
      { _id: submission.id, 'evaluation.version': expectedVersion },
      { $set: { evaluation: submission.evaluation.toSnapshot() } },
    );
    return result.matchedCount === 1;
  }

  /** Takes the oldest queued evaluation and leases it to the caller. */
  async claimNext(now: Date, leaseMs: number): Promise<Submission | undefined> {
    // ponytail: a few rounds of find-then-compare-and-set; a real queue replaces this when there are many workers.
    for (let round = 0; round < 5; round += 1) {
      const doc = await this.models.Submission.findOne({ 'evaluation.status': 'SUBMITTED' })
        .sort({ createdAt: 1 })
        .lean<SubmissionDoc>();
      if (!doc) return undefined;

      const submission = toSubmission(doc);
      const expected = submission.evaluation.version;
      submission.evaluation.start(now, leaseMs);
      if (await this.saveEvaluation(submission, expected)) return submission;
    }
    return undefined;
  }

  /** Evaluations whose worker stopped renewing its lease: it crashed or hung. */
  async findExpiredLeases(now: Date): Promise<Submission[]> {
    const docs = await this.models.Submission.find({
      'evaluation.status': 'EVALUATING',
      'evaluation.lockedUntil': { $lte: now },
    }).lean<SubmissionDoc[]>();
    return docs.map(toSubmission);
  }
}

function toSubmission({ _id, ...rest }: SubmissionDoc): Submission {
  return new Submission({ id: _id, ...rest } as SubmissionSnapshot);
}
