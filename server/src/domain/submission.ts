import { createHash } from 'node:crypto';
import type { SubmissionContent } from '../../../shared/types.ts';
import { Evaluation, type EvaluationSnapshot } from './evaluation.ts';

export interface SubmissionSnapshot {
  id: string;
  attemptId: string;
  learnerId: string;
  problemSlug: string;
  version: number;
  content: SubmissionContent;
  contentHash: string;
  idempotencyKey: string;
  twistId?: string;
  createdAt: Date;
  evaluation: EvaluationSnapshot;
}

/** An immutable snapshot of what the learner submitted, plus the evaluation of it. */
export class Submission {
  readonly id: string;
  readonly attemptId: string;
  readonly learnerId: string;
  readonly problemSlug: string;
  readonly version: number;
  readonly content: SubmissionContent;
  readonly contentHash: string;
  readonly idempotencyKey: string;
  readonly twistId: string | undefined;
  readonly createdAt: Date;
  readonly evaluation: Evaluation;

  constructor(snapshot: SubmissionSnapshot) {
    this.id = snapshot.id;
    this.attemptId = snapshot.attemptId;
    this.learnerId = snapshot.learnerId;
    this.problemSlug = snapshot.problemSlug;
    this.version = snapshot.version;
    this.content = snapshot.content;
    this.contentHash = snapshot.contentHash;
    this.idempotencyKey = snapshot.idempotencyKey;
    this.twistId = snapshot.twistId;
    this.createdAt = snapshot.createdAt;
    this.evaluation = Evaluation.fromSnapshot(snapshot.evaluation);
  }

  toSnapshot(): SubmissionSnapshot {
    return {
      id: this.id,
      attemptId: this.attemptId,
      learnerId: this.learnerId,
      problemSlug: this.problemSlug,
      version: this.version,
      content: this.content,
      contentHash: this.contentHash,
      idempotencyKey: this.idempotencyKey,
      ...(this.twistId ? { twistId: this.twistId } : {}),
      createdAt: this.createdAt,
      evaluation: this.evaluation.toSnapshot(),
    };
  }
}

/**
 * A fingerprint of what the learner wrote. Whitespace at line ends and blank
 * sections do not count, so resubmitting the same design is recognised.
 */
export function contentHash(content: SubmissionContent): string {
  const canonical = [...content.artifacts]
    .sort((a, b) => a.kind.localeCompare(b.kind))
    .map((artifact) =>
      artifact.kind === 'design-notes'
        ? {
            kind: artifact.kind,
            sections: Object.entries(artifact.sections)
              .map(([id, text]) => [id, (text ?? '').trim()] as const)
              .filter(([, text]) => text)
              .sort(([a], [b]) => a.localeCompare(b)),
          }
        : { kind: artifact.kind, source: artifact.source.replace(/[ \t]+$/gm, '').trim() },
    );
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

/** True when the learner actually wrote something. */
export function hasContent(content: SubmissionContent): boolean {
  return content.artifacts.some((artifact) =>
    artifact.kind === 'design-notes'
      ? Object.values(artifact.sections).some((text) => (text ?? '').trim().length > 0)
      : artifact.source.trim().length > 0,
  );
}
