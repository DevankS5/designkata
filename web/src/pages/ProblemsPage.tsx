import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import type { ProblemSummaryDto } from '../../../shared/types.ts';
import { api } from '../api.ts';
import { DifficultyTag, ErrorBox, LevelStrip, Loading } from '../ui.tsx';

export function ProblemsPage() {
  const [problems, setProblems] = useState<ProblemSummaryDto[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.problems().then(setProblems, setError);
  }, []);

  // Continue the latest attempt at this problem, or start one.
  async function open(problem: ProblemSummaryDto, fresh = false) {
    setOpening(problem.slug);
    try {
      const existing = fresh ? [] : await api.attempts(problem.slug);
      const attempt = existing[0] ?? (await api.startAttempt(problem.slug));
      navigate(`/attempts/${attempt.id}`);
    } catch (e) {
      setError(e);
      setOpening(null);
    }
  }

  return (
    <main>
      <p className="eyebrow">Low-level design practice</p>
      <h1 className="page-title">Design it. Get feedback you can check. Then take the twist.</h1>
      <p className="lede">
        Write a short design and a class diagram. Rules check the structure instantly, an AI reviewer judges six qualities
        and has to quote your own words, and the twist shows how much of your design a new requirement forces you to
        change.
      </p>

      <section className="how" aria-label="How feedback works">
        <div className="how-step">
          <strong>1. Rules, instantly</strong>
          <span>Missing concepts, a class doing everything, parts that vary with no abstraction.</span>
        </div>
        <div className="how-step">
          <strong>2. A rubric, with receipts</strong>
          <span>Six criteria on four levels. Every judgment quotes you, and each quote is checked.</span>
        </div>
        <div className="how-step">
          <strong>3. The twist</strong>
          <span>A new requirement, like an interviewer's follow-up. We count the classes you had to edit.</span>
        </div>
      </section>

      {error ? <ErrorBox error={error} /> : null}
      {!problems && !error && <Loading what="problems" />}
      {problems && (
        <div className="problem-list">
          {problems.map((problem, i) => (
            <article key={problem.slug} className="problem-row reveal" style={{ ['--i' as string]: i }}>
              <div className="problem-meta">
                <DifficultyTag difficulty={problem.difficulty} />
                <span className="muted small">{problem.timeboxMinutes} minutes</span>
                <LevelStrip levels={problem.latestLevels} label="Your latest levels" />
              </div>
              <div>
                <h2>{problem.title}</h2>
                <p>{problem.summary}</p>
                {problem.origin && <p className="origin">{problem.origin}</p>}
              </div>
              <div className="button-row">
                {problem.attempts > 0 ? (
                  <>
                    <button className="button primary" onClick={() => open(problem)} disabled={opening !== null}>
                      Continue
                    </button>
                    <button className="button ghost" onClick={() => open(problem, true)} disabled={opening !== null}>
                      Start fresh
                    </button>
                  </>
                ) : (
                  <button className="button primary" onClick={() => open(problem)} disabled={opening !== null}>
                    {opening === problem.slug ? 'Opening...' : 'Start'}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
