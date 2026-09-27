import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { ProgressDto } from '../../../shared/types.ts';
import { RUBRIC } from '../../../shared/rubric.ts';
import { api } from '../api.ts';
import { ErrorBox, LevelStrip, Loading } from '../ui.tsx';

const RULE_NAMES: Record<string, string> = {
  'god-class': 'One class doing too much',
  'missing-abstraction': 'A part that varies with no abstraction',
  'missing-concept': 'A core concept missing from the diagram',
  'missing-section': 'Notes sections left thin',
  'diagram-syntax': 'Diagram lines that could not be read',
};

export function ProgressPage() {
  const [progress, setProgress] = useState<ProgressDto | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    api.progress().then(setProgress, setError);
  }, []);

  if (error) return <ErrorBox error={error} />;
  if (!progress) return <Loading what="your progress" />;

  return (
    <main>
      <p className="eyebrow">Your practice</p>
      <h1 className="page-title">What keeps coming back</h1>
      <p className="lede">
        {progress.reviewed === 0
          ? 'Nothing reviewed yet. Finish one design to start the record.'
          : `${progress.reviewed === 1 ? 'Based on your one reviewed design so far' : `Based on your last ${Math.min(progress.reviewed, 5)} reviewed designs`}. One weak attempt is noise; the same weakness twice is a pattern.`}
      </p>

      {progress.weaknesses.length > 0 && (
        <>
          <div className="section-title">
            <h2>Recurring weaknesses</h2>
          </div>
          <div className="weaknesses">
            {progress.weaknesses.map((w, i) => {
              const criterion = RUBRIC.find((c) => c.id === w.criterionId)!;
              return (
                <article key={w.criterionId} className="weakness reveal" style={{ ['--i' as string]: i }}>
                  <h3>{criterion.name}</h3>
                  <p className="small muted">
                    At level 1 or 2 in {w.lowCount} of your last {w.outOf} reviews. Average level {w.averageLevel}.
                  </p>
                  <p className="small">
                    <b>What level 3 looks like:</b> {criterion.levels[3]}
                  </p>
                </article>
              );
            })}
          </div>
        </>
      )}

      {progress.recurringFindings.length > 0 && (
        <>
          <div className="section-title">
            <h2>Patterns in your diagrams</h2>
          </div>
          <ul className="findings">
            {progress.recurringFindings.map((f) => (
              <li key={f.ruleId} className="finding warning">
                <div>
                  <p>
                    <b>{RULE_NAMES[f.ruleId] ?? f.ruleId}</b>, in {f.count} of your last {f.outOf} submissions
                  </p>
                  <p className="suggestion">For example: {f.example}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="section-title">
        <h2>History</h2>
      </div>
      {progress.history.length === 0 ? (
        <div className="empty">
          <p>No submissions yet.</p>
          <Link className="button primary" to="/">
            Pick a problem
          </Link>
        </div>
      ) : (
        progress.history.map((entry) => (
          <div key={entry.attemptId} className="history-item">
            <h3>{entry.title}</h3>
            {entry.versions.map((v) => (
              <Link key={v.id} className="version-chip" to={`/submissions/${v.id}`}>
                v{v.version}
                {v.twistId ? ' twist' : ''}
                <LevelStrip levels={v.levels} label={`Version ${v.version}`} />
              </Link>
            ))}
            <Link className="small" to={`/attempts/${entry.attemptId}`} style={{ marginLeft: 'auto' }}>
              Open workspace
            </Link>
          </div>
        ))
      )}
    </main>
  );
}
