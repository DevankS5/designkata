import { Schema, type Connection, type Model } from 'mongoose';
import type { AttemptSnapshot } from '../domain/attempt.ts';
import type { SubmissionSnapshot } from '../domain/submission.ts';

// Documents store domain snapshots with the id as _id. Content and reports are
// validated at the HTTP boundary and built by our own code, so they are stored as-is.

export type AttemptDoc = Omit<AttemptSnapshot, 'id'> & { _id: string };
export type SubmissionDoc = Omit<SubmissionSnapshot, 'id'> & { _id: string };

const evaluationSchema = new Schema(
  {
    status: { type: String, enum: ['SUBMITTED', 'EVALUATING', 'COMPLETED', 'FAILED'], required: true },
    tries: { type: Number, required: true },
    version: { type: Number, required: true },
    lockedUntil: Date,
    startedAt: Date,
    completedAt: Date,
    error: String,
    report: Schema.Types.Mixed,
  },
  { _id: false, minimize: false },
);

const attemptSchema = new Schema<AttemptDoc>(
  {
    _id: { type: String, required: true },
    learnerId: { type: String, required: true },
    problemSlug: { type: String, required: true },
    draft: { type: Schema.Types.Mixed, required: true },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
  },
  { versionKey: false, minimize: false },
);
attemptSchema.index({ learnerId: 1, problemSlug: 1, createdAt: -1 });

// The evaluation lives inside the submission, so creating a submission and
// queueing its evaluation is one atomic write, with no transaction needed.
const submissionSchema = new Schema<SubmissionDoc>(
  {
    _id: { type: String, required: true },
    attemptId: { type: String, required: true },
    learnerId: { type: String, required: true },
    problemSlug: { type: String, required: true },
    version: { type: Number, required: true },
    content: { type: Schema.Types.Mixed, required: true },
    contentHash: { type: String, required: true },
    idempotencyKey: { type: String, required: true },
    twistId: String,
    createdAt: { type: Date, required: true },
    evaluation: { type: evaluationSchema, required: true },
  },
  { versionKey: false, minimize: false },
);
submissionSchema.index({ attemptId: 1, idempotencyKey: 1 }, { unique: true });
submissionSchema.index({ attemptId: 1, version: 1 }, { unique: true });
submissionSchema.index({ 'evaluation.status': 1, createdAt: 1 });
submissionSchema.index({ learnerId: 1, createdAt: -1 });

export interface Models {
  Attempt: Model<AttemptDoc>;
  Submission: Model<SubmissionDoc>;
}

export async function createModels(connection: Connection): Promise<Models> {
  const models = {
    Attempt: connection.model<AttemptDoc>('Attempt', attemptSchema),
    Submission: connection.model<SubmissionDoc>('Submission', submissionSchema),
  };
  // Unique indexes are part of the correctness story (idempotency), so build them before serving.
  await Promise.all([models.Attempt.init(), models.Submission.init()]);
  return models;
}
