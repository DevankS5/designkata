import type { ChangeImpact, FeedbackReport } from '../../../shared/types.ts';
import { diffModels } from '../analysis/change-impact.ts';
import { SubmissionAnalyzer } from '../analysis/submission-analyzer.ts';
import { DomainError } from '../domain/errors.ts';
import type { Submission } from '../domain/submission.ts';
import type { EvaluationContext } from '../evaluation/evaluator.ts';
import type { EvaluationPipeline } from '../evaluation/pipeline.ts';
import type { SubmissionRepository } from '../persistence/submission-repository.ts';
import { findProblem } from '../problems/index.ts';

/** Turns a stored submission into an evaluation context and runs the pipeline on it. */
export class SubmissionEvaluator {
  private readonly submissions: SubmissionRepository;
  private readonly pipeline: EvaluationPipeline;
  private readonly analyzer: SubmissionAnalyzer;

  constructor(submissions: SubmissionRepository, pipeline: EvaluationPipeline, analyzer = new SubmissionAnalyzer()) {
    this.submissions = submissions;
    this.pipeline = pipeline;
    this.analyzer = analyzer;
  }

  async evaluate(submission: Submission, onPartial?: (report: FeedbackReport) => Promise<void>): Promise<FeedbackReport> {
    const problem = findProblem(submission.problemSlug);
    if (!problem) throw new DomainError('not-found', `Unknown problem "${submission.problemSlug}".`);

    const analysis = this.analyzer.analyze(submission.content);
    const changeImpact = await this.changeSincePreviousVersion(submission, analysis.model);
    const context: EvaluationContext = {
      problem,
      analysis,
      findings: [],
      ...(submission.twistId ? { twist: problem.twist } : {}),
      ...(changeImpact ? { changeImpact } : {}),
    };
    return this.pipeline.run(context, onPartial);
  }

  private async changeSincePreviousVersion(
    submission: Submission,
    model: EvaluationContext['analysis']['model'],
  ): Promise<ChangeImpact | undefined> {
    if (submission.version <= 1) return undefined;
    const previous = await this.submissions.findVersion(submission.attemptId, submission.version - 1);
    if (!previous) return undefined;
    const before = this.analyzer.analyze(previous.content).model;
    return before.isEmpty || model.isEmpty ? undefined : diffModels(before, model);
  }
}
