import type { CriterionId, Difficulty, EvaluationStatus, Finding, Level, LevelMap } from '../../shared/types.ts';
import { RUBRIC } from '../../shared/rubric.ts';

export function DifficultyTag({ difficulty }: { difficulty: Difficulty }) {
  return <span className={`tag ${difficulty.toLowerCase()}`}>{difficulty}</span>;
}

/** Six small squares, one per rubric criterion, coloured by level. Grey means not judged. */
export function LevelStrip({ levels, label }: { levels: LevelMap | undefined; label?: string }) {
  const summary = RUBRIC.map((c) => `${c.name}: ${levels?.[c.id] ?? 'not judged'}`).join(', ');
  return (
    <span className="level-strip" role="img" aria-label={label ? `${label}. ${summary}` : summary} title={summary}>
      {RUBRIC.map((c) => (
        <i key={c.id} data-level={levels?.[c.id] ?? ''} />
      ))}
    </span>
  );
}

export function LevelMeter({ level }: { level: Level }) {
  return (
    <span className="meter" data-level={level} role="img" aria-label={`Level ${level} of 4`}>
      <span className="meter-bars">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className="meter-label">Level {level} of 4</span>
    </span>
  );
}

const STEPS: EvaluationStatus[] = ['SUBMITTED', 'EVALUATING', 'COMPLETED'];
const WORDS: Record<EvaluationStatus, string> = {
  SUBMITTED: 'Submitted',
  EVALUATING: 'Evaluating',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
};

/** Submitted, evaluating, completed (or failed), as rubber stamps. */
export function StatusTimeline({ status }: { status: EvaluationStatus }) {
  const last = status === 'FAILED' ? 'FAILED' : 'COMPLETED';
  const steps = [...STEPS.slice(0, 2), last] as EvaluationStatus[];
  const reached = status === 'FAILED' ? 2 : STEPS.indexOf(status);
  return (
    <div className="timeline" aria-label={`Status: ${WORDS[status]}`}>
      {steps.map((step, index) => {
        const done = index < reached || (index === reached && (status === 'COMPLETED' || status === 'FAILED'));
        const current = index === reached && !done;
        const className = ['stamp', done ? 'done' : '', current ? 'current' : '', done && step === 'COMPLETED' ? 'completed' : '', done && step === 'FAILED' ? 'failed' : '']
          .filter(Boolean)
          .join(' ');
        return (
          <span key={step} style={{ display: 'contents' }}>
            {index > 0 && <span className="arrow">&rarr;</span>}
            <span className={className}>{WORDS[step]}</span>
          </span>
        );
      })}
    </div>
  );
}

export function FindingList({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) return <p className="muted">No structural problems found.</p>;
  return (
    <ul className="findings">
      {findings.map((f, i) => (
        <li key={`${f.ruleId}-${i}`} className={`finding ${f.severity}`}>
          <div>
            <p>{f.message}</p>
            <p className="suggestion">{f.suggestion}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function criterionName(id: CriterionId): string {
  return RUBRIC.find((c) => c.id === id)?.name ?? id;
}

export function Loading({ what }: { what: string }) {
  return <p className="loading">Loading {what}...</p>;
}

export function ErrorBox({ error }: { error: unknown }) {
  return <div className="error-box">{error instanceof Error ? error.message : 'Something went wrong.'}</div>;
}
