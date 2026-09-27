import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import type { AttemptDto, Finding, NoteSectionId, NoteSections, ProblemDto } from '../../../shared/types.ts';
import { api, buildContent, diagramOf, notesOf } from '../api.ts';
import { DiagramPreview } from '../DiagramPreview.tsx';
import { DifficultyTag, ErrorBox, FindingList, LevelStrip, Loading } from '../ui.tsx';

const FIELDS: { id: NoteSectionId; label: string; hint: string; rows: number }[] = [
  {
    id: 'requirements',
    label: 'Requirements and assumptions',
    hint: 'What must the system do? What will it not do? What are you assuming?',
    rows: 5,
  },
  { id: 'entities', label: 'Entities and responsibilities', hint: 'Your main classes, one line each on what they own.', rows: 5 },
  { id: 'flows', label: 'Key flows', hint: 'Walk through the main use case step by step. Which class does each step?', rows: 5 },
  { id: 'patterns', label: 'Patterns and trade-offs', hint: 'Which choices did you make, what did you reject, and why?', rows: 4 },
  { id: 'edgeCases', label: 'Edge cases', hint: 'Full capacity, two requests at once, failures. Which class handles each?', rows: 4 },
];

const CHANGE_FIELD = {
  id: 'changeAnswer' as const,
  label: 'What changed and why',
  hint: 'List the classes you added, the classes you had to edit, and why each edit was needed.',
  rows: 5,
};

const CHEATSHEET: [string, string][] = [
  ['A <|-- B', 'B extends A'],
  ['A <|.. B', 'B implements interface A'],
  ['A *-- B', 'A owns B (composition)'],
  ['A o-- B', 'A has B (aggregation)'],
  ['A --> B', 'A uses B'],
  ['A ..> B', 'A depends on B'],
  ['<<interface>>', 'inside a class body: marks an interface'],
  ['+park(Vehicle v) Ticket', 'a public method'],
  ['-List~Level~ levels', 'a private field'],
];

type SaveState = 'saved' | 'saving' | 'unsaved' | 'error';

export function WorkspacePage() {
  const { attemptId = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState<AttemptDto | null>(null);
  const [problem, setProblem] = useState<ProblemDto | null>(null);
  const [sections, setSections] = useState<NoteSections>({});
  const [diagram, setDiagram] = useState('');
  const [tab, setTab] = useState<'notes' | 'diagram'>('notes');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [busy, setBusy] = useState<'checking' | 'submitting' | null>(null);
  const [error, setError] = useState<unknown>(null);
  const edited = useRef(false);
  // One key per submit intent: a retried request after a network blip cannot create a second version.
  const submitKey = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const loaded = await api.attempt(attemptId);
        const brief = await api.problem(loaded.problemSlug);
        if (!alive) return;
        setAttempt(loaded);
        setProblem(brief);
        setSections(notesOf(loaded.draft));
        setDiagram(diagramOf(loaded.draft));
      } catch (e) {
        if (alive) setError(e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [attemptId]);

  // Autosave a second after the learner stops typing.
  useEffect(() => {
    if (!attempt || !edited.current) return;
    setSaveState('unsaved');
    const handle = window.setTimeout(async () => {
      setSaveState('saving');
      try {
        await api.saveDraft(attempt.id, buildContent(sections, diagram));
        setSaveState('saved');
      } catch {
        setSaveState('error');
      }
    }, 1000);
    return () => window.clearTimeout(handle);
  }, [sections, diagram, attempt]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (saveState === 'unsaved' || saveState === 'saving') event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saveState]);

  if (error && !attempt) return <ErrorBox error={error} />;
  if (!attempt || !problem) return <Loading what="your workspace" />;

  const twistMode = params.get('twist') === '1' && attempt.twistUnlocked;
  const hasWork = Object.values(sections).some((t) => t?.trim()) || diagram.trim() !== problem.starterDiagram.trim();

  const change = (update: () => void) => {
    edited.current = true;
    submitKey.current = null;
    setFindings(null);
    update();
  };

  function loadSample() {
    if (!problem?.sample) return;
    if (hasWork && !window.confirm('Replace your notes and diagram with the sample design?')) return;
    change(() => {
      setSections(notesOf(problem.sample!));
      setDiagram(diagramOf(problem.sample!));
    });
  }

  async function checkStructure() {
    setBusy('checking');
    setError(null);
    try {
      setFindings((await api.check(problem!.slug, buildContent(sections, diagram))).findings);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }

  async function submit() {
    setBusy('submitting');
    setError(null);
    submitKey.current ??= crypto.randomUUID();
    try {
      // "What changed and why" belongs to the twist; a normal revision does not send it.
      const { changeAnswer: _unused, ...plain } = sections;
      const notes = twistMode ? sections : plain;
      const submission = await api.submit(attempt!.id, buildContent(notes, diagram), submitKey.current, twistMode ? problem!.twist.id : undefined);
      submitKey.current = null;
      navigate(`/submissions/${submission.id}`);
    } catch (e) {
      setError(e);
      setBusy(null);
    }
  }

  const fields = twistMode ? [CHANGE_FIELD, ...FIELDS] : FIELDS;
  const latest = attempt.submissions.at(-1);

  return (
    <main className="workspace">
      <aside className="brief" aria-label="Problem brief">
        <p className="eyebrow">
          <DifficultyTag difficulty={problem.difficulty} /> &nbsp;{problem.timeboxMinutes} minute practice
        </p>
        <h1>{problem.title}</h1>
        <p>{problem.context}</p>
        {problem.origin && <p className="origin small">{problem.origin}</p>}
        <h3>Requirements</h3>
        <ol>
          {problem.requirements.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ol>
        <h3>Out of scope</h3>
        <ul>
          {problem.outOfScope.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
        <details>
          <summary>Stuck? Edge cases worth thinking about</summary>
          <ul>
            {problem.edgeCases.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </details>
        <div className={`twist-card ${attempt.twistUnlocked ? 'open' : ''}`}>
          <p className="eyebrow">The twist</p>
          {attempt.twistUnlocked ? (
            <>
              <h3>{problem.twist.title}</h3>
              {twistMode ? (
                <p className="small">You are answering it now. Change your design, then explain what changed.</p>
              ) : (
                <Link to={`/attempts/${attempt.id}?twist=1`} className="button pen" style={{ marginTop: 8 }}>
                  Take the twist
                </Link>
              )}
            </>
          ) : (
            <p className="small muted">An interviewer-style new requirement. It unlocks after your latest version has been reviewed.</p>
          )}
        </div>
      </aside>

      <section>
        {attempt.submissions.length > 0 && (
          <nav className="versions" aria-label="Your versions">
            {attempt.submissions.map((s) => (
              <Link key={s.id} to={`/submissions/${s.id}`} className="version-chip">
                v{s.version}
                {s.twistId ? ' twist' : ''}
                <LevelStrip levels={s.levels} label={`Version ${s.version}`} />
              </Link>
            ))}
          </nav>
        )}

        {twistMode && (
          <div className="banner">
            <strong>Twist: {problem.twist.title}</strong>
            <p>{problem.twist.prompt}</p>
          </div>
        )}
        {!twistMode && latest && (
          <div className="banner info">
            <strong>Revising version {latest.version}.</strong>
            <p>Your draft starts from what you last submitted. Submitting creates version {latest.version + 1}.</p>
          </div>
        )}

        <div className="work">
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'notes'} onClick={() => setTab('notes')}>
              Design notes
            </button>
            <button role="tab" aria-selected={tab === 'diagram'} onClick={() => setTab('diagram')}>
              Class diagram
            </button>
          </div>

          {tab === 'notes' ? (
            <div className="tab-panel" role="tabpanel">
              {fields.map((field) => (
                <div key={field.id} className="field">
                  <label htmlFor={field.id}>{field.label}</label>
                  <span className="hint">{field.hint}</span>
                  <textarea
                    id={field.id}
                    rows={field.rows}
                    value={sections[field.id] ?? ''}
                    maxLength={6000}
                    onChange={(e) => change(() => setSections((s) => ({ ...s, [field.id]: e.target.value })))}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="tab-panel diagram-layout" role="tabpanel">
              <div className="field">
                <label htmlFor="diagram">Mermaid class diagram</label>
                <span className="hint">Write the diagram as text. It is parsed, so the rules can check it and diff it.</span>
                <textarea
                  id="diagram"
                  className="editor"
                  spellCheck={false}
                  value={diagram}
                  maxLength={12000}
                  onChange={(e) => change(() => setDiagram(e.target.value))}
                />
              </div>
              <DiagramPreview source={diagram} />
              <details className="cheatsheet">
                <summary>Mermaid cheat sheet</summary>
                <table>
                  <tbody>
                    {CHEATSHEET.map(([syntax, meaning]) => (
                      <tr key={syntax}>
                        <td>{syntax}</td>
                        <td>{meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </div>
          )}

          {findings && (
            <div className="tab-panel" style={{ borderTop: '1px solid var(--rule)' }}>
              <h3 style={{ marginBottom: 10 }}>Structure check</h3>
              <FindingList findings={findings} />
            </div>
          )}

          <div className="actionbar">
            <span className={`save-state ${saveState === 'error' ? 'error' : ''}`} aria-live="polite">
              {{ saved: 'All changes saved', saving: 'Saving...', unsaved: 'Unsaved changes', error: 'Could not save. Keep this tab open.' }[saveState]}
            </span>
            {problem.sample && !twistMode && (
              <button className="button ghost" onClick={loadSample} disabled={busy !== null}>
                Load sample design
              </button>
            )}
            <button className="button" onClick={checkStructure} disabled={busy !== null}>
              {busy === 'checking' ? 'Checking...' : 'Check structure'}
            </button>
            <button className="button primary" onClick={submit} disabled={busy !== null}>
              {busy === 'submitting' ? 'Submitting...' : twistMode ? 'Submit twist answer' : 'Submit for review'}
            </button>
          </div>
          {error ? (
            <div className="tab-panel">
              <ErrorBox error={error} />
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
