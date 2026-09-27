import { Attempt, type AttemptSnapshot } from '../domain/attempt.ts';
import type { AttemptDoc, Models } from './models.ts';

export class AttemptRepository {
  private readonly models: Models;

  constructor(models: Models) {
    this.models = models;
  }

  async save(attempt: Attempt): Promise<void> {
    const { id, ...rest } = attempt.toSnapshot();
    await this.models.Attempt.replaceOne({ _id: id }, { _id: id, ...rest }, { upsert: true });
  }

  async findById(id: string): Promise<Attempt | undefined> {
    const doc = await this.models.Attempt.findById(id).lean<AttemptDoc>();
    return doc ? toAttempt(doc) : undefined;
  }

  async listForLearner(learnerId: string, problemSlug?: string): Promise<Attempt[]> {
    const docs = await this.models.Attempt.find({ learnerId, ...(problemSlug ? { problemSlug } : {}) })
      .sort({ createdAt: -1 })
      .lean<AttemptDoc[]>();
    return docs.map(toAttempt);
  }
}

function toAttempt({ _id, ...rest }: AttemptDoc): Attempt {
  return new Attempt({ id: _id, ...rest } as AttemptSnapshot);
}
