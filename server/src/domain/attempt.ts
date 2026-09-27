import type { SubmissionContent } from '../../../shared/types.ts';
import { DomainError } from './errors.ts';
import { Evaluation } from './evaluation.ts';
import type { Problem } from './problem.ts';
import { Submission, contentHash, hasContent } from './submission.ts';

export interface AttemptSnapshot {
  id: string;
  learnerId: string;
  problemSlug: string;
  draft: SubmissionContent;
  createdAt: Date;
  updatedAt: Date;
}

export type SubmitOutcome =
  | { kind: 'created'; submission: Submission }
  /** Nothing changed since the latest version, so that version is the answer. No new evaluation. */
  | { kind: 'unchanged'; submission: Submission };

export interface SubmitCommand {
  id: string;
  content: SubmissionContent;
  idempotencyKey: string;
  twistId?: string;
  problem: Problem;
  latest?: Submission;
  now: Date;
}

/** One learner working on one problem. Owns the draft and the rules for turning it into versions. */
export class Attempt {
  readonly id: string;
  readonly learnerId: string;
  readonly problemSlug: string;
  readonly createdAt: Date;
  private currentDraft: SubmissionContent;
  private lastUpdated: Date;

  constructor(snapshot: AttemptSnapshot) {
    this.id = snapshot.id;
    this.learnerId = snapshot.learnerId;
    this.problemSlug = snapshot.problemSlug;
    this.createdAt = snapshot.createdAt;
    this.currentDraft = snapshot.draft;
    this.lastUpdated = snapshot.updatedAt;
  }

  static start(input: { id: string; learnerId: string; problem: Problem; now: Date }): Attempt {
    return new Attempt({
      id: input.id,
      learnerId: input.learnerId,
      problemSlug: input.problem.slug,
      draft: {
        artifacts: [
          { kind: 'design-notes', sections: {} },
          { kind: 'class-diagram', format: 'mermaid', source: input.problem.starterDiagram },
        ],
      },
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  get draft(): SubmissionContent {
    return this.currentDraft;
  }

  get updatedAt(): Date {
    return this.lastUpdated;
  }

  saveDraft(content: SubmissionContent, now: Date): void {
    this.currentDraft = content;
    this.lastUpdated = now;
  }

  submit(command: SubmitCommand): SubmitOutcome {
    const { content, latest, twistId, problem } = command;
    if (problem.slug !== this.problemSlug) throw new DomainError('validation', 'This submission is for a different problem.');
    if (!hasContent(content)) throw new DomainError('validation', 'Write something before submitting.');

    if (twistId !== undefined) {
      if (twistId !== problem.twist.id) throw new DomainError('validation', `Unknown twist "${twistId}".`);
      if (!latest || latest.evaluation.status !== 'COMPLETED') {
        throw new DomainError('conflict', 'The twist unlocks once your first design has been reviewed.');
      }
    }

    const hash = contentHash(content);
    if (latest && latest.contentHash === hash && latest.twistId === twistId) {
      return { kind: 'unchanged', submission: latest };
    }

    this.saveDraft(content, command.now);
    const submission = new Submission({
      id: command.id,
      attemptId: this.id,
      learnerId: this.learnerId,
      problemSlug: this.problemSlug,
      version: (latest?.version ?? 0) + 1,
      content,
      contentHash: hash,
      idempotencyKey: command.idempotencyKey,
      ...(twistId ? { twistId } : {}),
      createdAt: command.now,
      evaluation: Evaluation.submitted().toSnapshot(),
    });
    return { kind: 'created', submission };
  }

  toSnapshot(): AttemptSnapshot {
    return {
      id: this.id,
      learnerId: this.learnerId,
      problemSlug: this.problemSlug,
      draft: this.currentDraft,
      createdAt: this.createdAt,
      updatedAt: this.lastUpdated,
    };
  }
}
