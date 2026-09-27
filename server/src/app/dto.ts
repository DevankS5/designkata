import type {
  AttemptDto,
  FeedbackReport,
  LevelMap,
  ProblemDto,
  SubmissionDto,
  SubmissionSummaryDto,
} from '../../../shared/types.ts';
import type { Attempt } from '../domain/attempt.ts';
import type { Problem } from '../domain/problem.ts';
import type { Submission } from '../domain/submission.ts';

// Domain objects stay inside the server. These functions decide exactly what leaves it.

export function levelsOf(report: FeedbackReport | undefined): LevelMap {
  return Object.fromEntries((report?.criteria ?? []).map((c) => [c.criterionId, c.level]));
}

export function toProblemDto(problem: Problem): ProblemDto {
  return {
    slug: problem.slug,
    title: problem.title,
    difficulty: problem.difficulty,
    timeboxMinutes: problem.timeboxMinutes,
    summary: problem.summary,
    context: problem.context,
    ...(problem.origin ? { origin: problem.origin } : {}),
    requirements: problem.requirements,
    outOfScope: problem.outOfScope,
    edgeCases: problem.edgeCases.map((e) => e.description),
    starterDiagram: problem.starterDiagram,
    ...(problem.sample ? { sample: problem.sample } : {}),
    twist: problem.twist,
  };
}

export function toSummaryDto(submission: Submission): SubmissionSummaryDto {
  return {
    id: submission.id,
    version: submission.version,
    ...(submission.twistId ? { twistId: submission.twistId } : {}),
    createdAt: submission.createdAt.toISOString(),
    status: submission.evaluation.status,
    levels: levelsOf(submission.evaluation.report),
  };
}

export function toAttemptDto(attempt: Attempt, submissions: readonly Submission[]): AttemptDto {
  const latest = submissions.at(-1);
  return {
    id: attempt.id,
    problemSlug: attempt.problemSlug,
    draft: attempt.draft,
    createdAt: attempt.createdAt.toISOString(),
    updatedAt: attempt.updatedAt.toISOString(),
    submissions: submissions.map(toSummaryDto),
    twistUnlocked: latest?.evaluation.status === 'COMPLETED',
  };
}

export function toSubmissionDto(submission: Submission, previous?: Submission): SubmissionDto {
  const snapshot = submission.evaluation.toSnapshot();
  const previousLevels = levelsOf(previous?.evaluation.report);
  return {
    id: submission.id,
    attemptId: submission.attemptId,
    problemSlug: submission.problemSlug,
    version: submission.version,
    ...(submission.twistId ? { twistId: submission.twistId } : {}),
    createdAt: submission.createdAt.toISOString(),
    content: submission.content,
    evaluation: {
      status: snapshot.status,
      tries: snapshot.tries,
      canRetry: submission.evaluation.canRetry,
      ...(snapshot.error ? { error: snapshot.error } : {}),
      ...(snapshot.report ? { report: snapshot.report } : {}),
    },
    ...(Object.keys(previousLevels).length ? { previousLevels } : {}),
  };
}
