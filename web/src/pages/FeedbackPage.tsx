import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { AttemptDto, ChangeImpact, CriterionFeedback, ProblemDto, SubmissionDto } from '../../../shared/types.ts';
import { RUBRIC } from '../../../shared/rubric.ts';
import { api, diagramOf, notesOf } from '../api.ts';
import { DiagramPreview } from '../DiagramPreview.tsx';
import { ErrorBox, FindingList, LevelMeter, Loading, StatusTimeline, criterionName } from '../ui.tsx';

const IMPACT_WORDS: Record<ChangeImpact['label'], string> = {
  additive: 'Additive: no existing class had to change.',
  localized: 'Localized: one or two existing classes had to change.',
  wide: 'Wide: three or more existing classes had to change.',
};

export function FeedbackPage() {
  const { submissionId = '' } = useParams();
  const [submission, setSubmission] = useState<SubmissionDto | null>(null);
  const [problem, setProblem] = useState<ProblemDto | null>(null);
  const [attempt, setAttempt] = useState<AttemptDto | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [poll, setPoll] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Poll while the review runs; stop once it has an outcome.
  useEffect(() => {
    let alive = true;
    let timer: number | undefined;
    const load = async () => {
      try {
        const current = await api.submission(submissionId);
        if (!alive) return;
        setSubmission(current);
        if (current.evaluation.status === 'SUBMITTED' || current.evaluation.status === 'EVALUATING') {
          timer = window.setTimeout(load, 1500);
        } else {
          const owner = await api.attempt(current.attemptId);
          if (alive) setAttempt(owner);
        }
      } catch (e) {
        if (alive) setError(e);
      }
    };
    void load();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [submissionId, poll]);

  useEffect(() => {
    if (submission && !problem) api.problem(submission.problemSlug).then(setProblem, setError);
  }, [submission, problem]);

  const pending = submission?.evaluation.status === 'SUBMITTED' || submission?.evaluation.status === 'EVALUATING';
  useEffect(() => {
    if (!pending) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [pending]);

  if (error && !submission) return <ErrorBox error={error} />;
  if (!submission) return <Loading what="your feedback" />;

  const { evaluation } = submission;
  const report = evaluation.report;
  const elapsed = Math.max(0, Math.round((now - Date.parse(submission.createdAt)) / 1000));
  const latestVersion = attempt?.submissions.at(-1)?.version;
  const isLatest = latestVersion === undefined || latestVersion === submission.version;

  async function retry() {
    setRetrying(true);
    try {
      setSubmission(await api.retry(submission!.id));
      setPoll((p) => p + 1);
    } catch (e) {
      setError(e);
    } finally {
      setRetrying(false);
    }
  }

  const criteria = RUBRIC.map((c) => report?.criteria.find((f) => f.criterionId === c.id)).filter(
    (c): c is CriterionFeedback => Boolean(c),
  );

  return (
    <main>
      <div className="feedback-head">
        <div>
          <p className="eyebrow">
            {problem?.title ?? submission.problemSlug} &middot; version {submission.version}
            {submission.twistId ? ` · twist: ${problem?.twist.title ?? submission.twistId}` : ''}
          </p>
          <h1 className="page-title">Feedback on version {submission.version}</h1>
        </div>
        <div>
          <StatusTimeline status={evaluation.status} />
          {pending && <p className="muted small" style={{ textAlign: 'right' }}>{elapsed} s so far</p>}
        </div>
      </div>

      {!isLatest && (
        <div className="banner info">
          <strong>This is an older version.</strong>
          <p>
            Your latest is version {latestVersion}. <Link to={`/attempts/${submission.attemptId}`}>Open the workspace</Link>
          </p>
        </div>
      )}

      {pending && (
        <div className="banner info" aria-live="polite">
          <strong>{report ? 'Rule checks are in. The AI reviewer is reading your design.' : 'Queued. Rule checks run first.'}</strong>
          <p>This usually takes about 15 seconds. You can leave this page; the review is saved to your history.</p>
        </div>
      )}

      {evaluation.status === 'FAILED' && (
        <div className="banner">
          <strong>The AI review failed: {evaluation.error ?? 'unknown error'}</strong>
          <p>Your submission is saved and the rule checks below still apply.</p>
          <div className="button-row" style={{ marginTop: 10 }}>
            {evaluation.canRetry ? (
              <button className="button pen" onClick={retry} disabled={retrying}>
                {retrying ? 'Retrying...' : 'Retry the review'}
              </button>
            ) : (
              <span className="small">This review has failed three times. Try again later with a new version.</span>
            )}
          </div>
        </div>
      )}

      {report?.ai.state === 'not-configured' && (
        <div className="banner info">
          <strong>Rules only.</strong>
          <p>No AI reviewer is configured on this server, so this is the deterministic feedback alone.</p>
        </div>
      )}

      {report?.nextFocus && (
        <section className="focus reveal" aria-label="Next focus">
          <p className="eyebrow">Work on this next</p>
          <h2>{criterionName(report.nextFocus.criterionId)}</h2>
          <p>{report.nextFocus.action}</p>
        </section>
      )}

      {report?.summary && <p className="summary">{report.summary}</p>}

      {criteria.length > 0 && (
        <>
          <div className="section-title">
            <h2>Rubric</h2>
            <span className="muted small">
              {report!.evidence.verified} of {report!.evidence.total} quotes found word for word in your design
            </span>
          </div>
          <div className="criteria">
            {criteria.map((c, i) => (
              <CriterionCard key={c.criterionId} feedback={c} previous={submission.previousLevels?.[c.criterionId]} index={i} />
            ))}
          </div>
        </>
      )}

      {report?.changeImpact && <ImpactPanel impact={report.changeImpact} version={submission.version} twist={Boolean(submission.twistId)} />}

      {report && (
        <>
          <div className="section-title">
            <h2>Structure checks</h2>
            <span className="muted small">Deterministic, instant and free</span>
          </div>
          <FindingList findings={report.findings} />
        </>
      )}

      {!pending && (
        <div className="button-row" style={{ marginTop: 32 }}>
          <Link className="button primary" to={`/attempts/${submission.attemptId}`}>
            Revise this design
          </Link>
          {attempt?.twistUnlocked && isLatest && !submission.twistId && (
            <Link className="button pen" to={`/attempts/${submission.attemptId}?twist=1`}>
              Take the twist
            </Link>
          )}
          <Link className="button ghost" to="/progress">
            See your progress
          </Link>
        </div>
      )}

      <details style={{ marginTop: 32 }}>
        <summary className="eyebrow" style={{ cursor: 'pointer' }}>
          What you submitted
        </summary>
        {Object.entries(notesOf(submission.content)).map(([id, text]) =>
          text ? (
            <div key={id} style={{ marginTop: 12 }}>
              <b>{id}</b>
              <p style={{ whiteSpace: 'pre-wrap', margin: '4px 0 0' }}>{text}</p>
            </div>
          ) : null,
        )}
        <div style={{ marginTop: 12 }}>
          <DiagramPreview source={diagramOf(submission.content)} />
        </div>
      </details>

      {report && report.runs.length > 0 && (
        <p className="runs">
          {report.runs.map((r) => `${r.evaluator} ${r.status} in ${(r.durationMs / 1000).toFixed(1)} s`).join(' · ')}
          {report.ai.model ? ` · ${report.ai.model}` : ''}
        </p>
      )}
    </main>
  );
}

function CriterionCard({ feedback, previous, index }: { feedback: CriterionFeedback; previous?: number; index: number }) {
  const definition = RUBRIC.find((c) => c.id === feedback.criterionId)!;
  const delta = previous === undefined ? null : feedback.level - previous;
  return (
    <article className="criterion reveal" style={{ ['--i' as string]: index }}>
      <header>
        <div>
          <h3>{definition.name}</h3>
          {delta !== null && (
            <span className={`delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`}>
              {delta === 0 ? `Same as last version (${previous})` : `Was ${previous}, now ${feedback.level}`}
            </span>
          )}
        </div>
        <LevelMeter level={feedback.level} />
      </header>
      <p className="anchor">{definition.levels[feedback.level]}</p>
      {feedback.strength && (
        <p className="part">
          <b>What works</b>
          {feedback.strength}
        </p>
      )}
      {feedback.concern && (
        <p className="part concern">
          <b>Concern</b>
          {feedback.concern}
        </p>
      )}
      {feedback.suggestion && (
        <p className="part">
          <b>Next step</b>
          {feedback.suggestion}
        </p>
      )}
      {feedback.evidence.length > 0 && (
        <ul className="quotes">
          {feedback.evidence.map((e) => (
            <li key={e.quote} className={`quote ${e.verified ? '' : 'unverified'}`}>
              {e.quote}
            </li>
          ))}
        </ul>
      )}
      {feedback.confidence === 'low' && <p className="small muted">Reviewer confidence is low for this criterion.</p>}
    </article>
  );
}

function ImpactPanel({ impact, version, twist }: { impact: ChangeImpact; version: number; twist: boolean }) {
  return (
    <>
      <div className="section-title">
        <h2>{twist ? 'How your design absorbed the twist' : `What changed since version ${version - 1}`}</h2>
        <span className="muted small">Measured by diffing the two class diagrams</span>
      </div>
      <div className="impact reveal">
        <div className="impact-number">
          {impact.blastRadius}
          <small>blast radius</small>
        </div>
        <div>
          <p style={{ margin: 0, fontWeight: 700 }}>{IMPACT_WORDS[impact.label]}</p>
          {impact.addedClasses.length > 0 && <p className="small">Added: {impact.addedClasses.join(', ')}</p>}
          {impact.modifiedClasses.length > 0 && (
            <>
              <p className="small" style={{ marginBottom: 0 }}>
                Edited:
              </p>
              <ul className="small">
                {impact.modifiedClasses.map((c) => (
                  <li key={c.name}>
                    <b>{c.name}</b>: {[...c.added.map((a) => `+ ${a}`), ...c.removed.map((r) => `- ${r}`)].join('; ')}
                  </li>
                ))}
              </ul>
            </>
          )}
          {impact.removedClasses.length > 0 && <p className="small">Removed: {impact.removedClasses.join(', ')}</p>}
        </div>
      </div>
    </>
  );
}
