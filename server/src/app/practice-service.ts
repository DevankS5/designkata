import { randomUUID } from 'node:crypto';
import type {
  AttemptDto,
  Finding,
  ProblemDto,
  ProblemSummaryDto,
  ProgressDto,
  SubmissionContent,
  SubmissionDto,
} from '../../../shared/types.ts';
import { SubmissionAnalyzer } from '../analysis/submission-analyzer.ts';
import { Attempt } from '../domain/attempt.ts';
import { DomainError } from '../domain/errors.ts';
import type { Problem } from '../domain/problem.ts';
import type { Submission } from '../domain/submission.ts';
import { RuleBasedEvaluator } from '../evaluation/rule-evaluator.ts';
import type { AttemptRepository } from '../persistence/attempt-repository.ts';
import type { SubmissionRepository } from '../persistence/submission-repository.ts';
import { findProblem, listProblems } from '../problems/index.ts';
import { levelsOf, toAttemptDto, toProblemDto, toSubmissionDto, toSummaryDto } from './dto.ts';
import { recurringFindings, recurringWeaknesses } from './progress.ts';
import { RateLimiter } from './rate-limiter.ts';

export interface PracticeDependencies {
  attempts: AttemptRepository;
  submissions: SubmissionRepository;
  /** Told about new work so evaluation starts at once instead of at the next poll. */
  worker: { nudge(): void };
  reviewLimiter?: RateLimiter;
  /** Caps reviews across everyone: learner ids come from the browser, so a per-learner limit alone can be dodged. */
  globalLimiter?: RateLimiter;
  now?: () => Date;
  newId?: () => string;
}

export interface SubmitInput {
  content: SubmissionContent;
  idempotencyKey: string;
  twistId?: string;
}

/**
 * The practice loop as use cases: choose a problem, work on an attempt,
 * submit, read the review, retry, and look back at progress. It knows the
 * worker only as something to nudge, so evaluators can change freely.
 */
export class PracticeService {
  private readonly attempts: AttemptRepository;
  private readonly submissions: SubmissionRepository;
  private readonly worker: { nudge(): void };
  private readonly reviewLimiter: RateLimiter;
  private readonly globalLimiter: RateLimiter;
  private readonly now: () => Date;
  private readonly newId: () => string;
  private readonly analyzer = new SubmissionAnalyzer();
  private readonly rules = new RuleBasedEvaluator();

  constructor(deps: PracticeDependencies) {
    this.attempts = deps.attempts;
    this.submissions = deps.submissions;
    this.worker = deps.worker;
    this.reviewLimiter = deps.reviewLimiter ?? new RateLimiter(12, 60 * 60 * 1000);
    this.globalLimiter = deps.globalLimiter ?? new RateLimiter(200, 60 * 60 * 1000);
    this.now = deps.now ?? (() => new Date());
    this.newId = deps.newId ?? randomUUID;
  }

  async listProblems(learnerId?: string): Promise<ProblemSummaryDto[]> {
    const [attempts, submissions] = learnerId
      ? await Promise.all([this.attempts.listForLearner(learnerId), this.submissions.listForLearner(learnerId)])
      : [[], []];

    return listProblems().map((problem) => {
      const reviewed = submissions.filter((s) => s.problemSlug === problem.slug && s.evaluation.report?.criteria.length);
      const latest = reviewed.at(-1);
      return {
        slug: problem.slug,
        title: problem.title,
        difficulty: problem.difficulty,
        timeboxMinutes: problem.timeboxMinutes,
        summary: problem.summary,
        ...(problem.origin ? { origin: problem.origin } : {}),
        attempts: attempts.filter((a) => a.problemSlug === problem.slug).length,
        ...(latest ? { latestLevels: levelsOf(latest.evaluation.report) } : {}),
      };
    });
  }

  getProblem(slug: string): ProblemDto {
    return toProblemDto(this.problem(slug));
  }

  async startAttempt(learnerId: string, problemSlug: string): Promise<AttemptDto> {
    const attempt = Attempt.start({ id: this.newId(), learnerId, problem: this.problem(problemSlug), now: this.now() });
    await this.attempts.save(attempt);
    return toAttemptDto(attempt, []);
  }

  async listAttempts(learnerId: string, problemSlug?: string): Promise<AttemptDto[]> {
    const attempts = await this.attempts.listForLearner(learnerId, problemSlug);
    return Promise.all(attempts.map(async (a) => toAttemptDto(a, await this.submissions.listForAttempt(a.id))));
  }

  async getAttempt(learnerId: string, attemptId: string): Promise<AttemptDto> {
    const attempt = await this.ownAttempt(learnerId, attemptId);
    return toAttemptDto(attempt, await this.submissions.listForAttempt(attempt.id));
  }

  async saveDraft(learnerId: string, attemptId: string, content: SubmissionContent): Promise<void> {
    const attempt = await this.ownAttempt(learnerId, attemptId);
    attempt.saveDraft(content, this.now());
    await this.attempts.save(attempt);
  }

  /** Stores the submission and queues its review. Safe to repeat with the same idempotency key. */
  async submit(learnerId: string, attemptId: string, input: SubmitInput): Promise<{ submission: SubmissionDto; created: boolean }> {
    const attempt = await this.ownAttempt(learnerId, attemptId);
    const replay = await this.submissions.findByIdempotencyKey(attempt.id, input.idempotencyKey);
    if (replay) return { submission: await this.withPrevious(replay), created: false };

    const latest = await this.submissions.findLatest(attempt.id);
    const outcome = attempt.submit({
      id: this.newId(),
      content: input.content,
      idempotencyKey: input.idempotencyKey,
      ...(input.twistId ? { twistId: input.twistId } : {}),
      problem: this.problem(attempt.problemSlug),
      ...(latest ? { latest } : {}),
      now: this.now(),
    });
    if (outcome.kind === 'unchanged') return { submission: await this.withPrevious(outcome.submission), created: false };

    this.takeReview(learnerId);
    const { submission, created } = await this.submissions.insert(outcome.submission);
    await this.attempts.save(attempt);
    if (created) this.worker.nudge();
    return { submission: await this.withPrevious(submission), created };
  }

  async getSubmission(learnerId: string, submissionId: string): Promise<SubmissionDto> {
    return this.withPrevious(await this.ownSubmission(learnerId, submissionId));
  }

  /** Queues a failed review again. */
  async retry(learnerId: string, submissionId: string): Promise<SubmissionDto> {
    const submission = await this.ownSubmission(learnerId, submissionId);
    const expected = submission.evaluation.version;
    submission.evaluation.retry();
    this.takeReview(learnerId);
    if (!(await this.submissions.saveEvaluation(submission, expected))) {
      throw new DomainError('conflict', 'This review changed while you were looking at it. Reload the page.');
    }
    this.worker.nudge();
    return this.withPrevious(submission);
  }

  /** The deterministic checks only, for a draft. Instant, free and nothing is saved. */
  checkStructure(problemSlug: string, content: SubmissionContent): Finding[] {
    const problem = this.problem(problemSlug);
    return this.rules.check({ problem, analysis: this.analyzer.analyze(content), findings: [] });
  }

  async progress(learnerId: string): Promise<ProgressDto> {
    const [attempts, submissions] = await Promise.all([
      this.attempts.listForLearner(learnerId),
      this.submissions.listForLearner(learnerId),
    ]);
    const reports = submissions.flatMap((s) => (s.evaluation.report ? [s.evaluation.report] : []));

    return {
      reviewed: reports.filter((r) => r.criteria.length > 0).length,
      weaknesses: recurringWeaknesses(reports),
      recurringFindings: recurringFindings(reports),
      history: attempts
        .map((attempt) => ({
          problemSlug: attempt.problemSlug,
          title: findProblem(attempt.problemSlug)?.title ?? attempt.problemSlug,
          attemptId: attempt.id,
          versions: submissions.filter((s) => s.attemptId === attempt.id).map(toSummaryDto),
        }))
        .filter((entry) => entry.versions.length > 0),
    };
  }

  private problem(slug: string): Problem {
    const problem = findProblem(slug);
    if (!problem) throw new DomainError('not-found', `There is no problem called "${slug}".`);
    return problem;
  }

  // Someone else's attempt is reported as missing, so ids cannot be probed.
  private async ownAttempt(learnerId: string, attemptId: string): Promise<Attempt> {
    const attempt = await this.attempts.findById(attemptId);
    if (!attempt || attempt.learnerId !== learnerId) throw new DomainError('not-found', 'Attempt not found.');
    return attempt;
  }

  private async ownSubmission(learnerId: string, submissionId: string): Promise<Submission> {
    const submission = await this.submissions.findById(submissionId);
    if (!submission || submission.learnerId !== learnerId) throw new DomainError('not-found', 'Submission not found.');
    return submission;
  }

  private async withPrevious(submission: Submission): Promise<SubmissionDto> {
    const previous = submission.version > 1 ? await this.submissions.findVersion(submission.attemptId, submission.version - 1) : undefined;
    return toSubmissionDto(submission, previous);
  }

  private takeReview(learnerId: string): void {
    const now = this.now().getTime();
    if (!this.reviewLimiter.take(learnerId, now)) {
      throw new DomainError('rate-limited', 'That is a lot of reviews in one hour. Take a short break and try again.');
    }
    if (!this.globalLimiter.take('everyone', now)) {
      throw new DomainError('rate-limited', 'The reviewer is busy right now. Try again in a few minutes.');
    }
  }
}
