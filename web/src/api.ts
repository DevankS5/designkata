import type {
  AttemptDto,
  Finding,
  HealthDto,
  NoteSections,
  ProblemDto,
  ProblemSummaryDto,
  ProgressDto,
  SubmissionContent,
  SubmissionDto,
} from '../../shared/types.ts';

// No accounts in the MVP: the browser keeps a random learner id.
const LEARNER_KEY = 'designkata.learnerId';
let sessionLearner: string | undefined;

export function learnerId(): string {
  try {
    let id = localStorage.getItem(LEARNER_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(LEARNER_KEY, id);
    }
    return id;
  } catch {
    // Storage can be blocked (private mode). Then practice lasts for this tab only.
    return (sessionLearner ??= crypto.randomUUID());
  }
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function call<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Learner-Id': learnerId(), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError(0, 'network', 'Could not reach the server. Check your connection and try again.');
  }
  if (response.status === 204) return undefined as T;
  const data = (await response.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
  if (!response.ok) {
    throw new ApiError(response.status, data.error?.code ?? 'error', data.error?.message ?? `Request failed (${response.status}).`);
  }
  return data as T;
}

export const api = {
  health: () => call<HealthDto>('GET', '/health'),
  problems: () => call<ProblemSummaryDto[]>('GET', '/problems'),
  problem: (slug: string) => call<ProblemDto>('GET', `/problems/${encodeURIComponent(slug)}`),
  check: (slug: string, content: SubmissionContent) =>
    call<{ findings: Finding[] }>('POST', `/problems/${encodeURIComponent(slug)}/check`, { content }),
  attempts: (problem?: string) =>
    call<AttemptDto[]>('GET', `/attempts${problem ? `?problem=${encodeURIComponent(problem)}` : ''}`),
  startAttempt: (problemSlug: string) => call<AttemptDto>('POST', '/attempts', { problemSlug }),
  attempt: (id: string) => call<AttemptDto>('GET', `/attempts/${id}`),
  saveDraft: (id: string, content: SubmissionContent) => call<void>('PUT', `/attempts/${id}/draft`, { content }),
  submit: (id: string, content: SubmissionContent, idempotencyKey: string, twistId?: string) =>
    call<SubmissionDto>('POST', `/attempts/${id}/submissions`, { content, ...(twistId ? { twistId } : {}) }, {
      'Idempotency-Key': idempotencyKey,
    }),
  submission: (id: string) => call<SubmissionDto>('GET', `/submissions/${id}`),
  retry: (id: string) => call<SubmissionDto>('POST', `/submissions/${id}/retry`),
  progress: () => call<ProgressDto>('GET', '/progress'),
};

// ---------- Reading and writing the two artifacts of a submission ----------

export function notesOf(content: SubmissionContent): NoteSections {
  const notes = content.artifacts.find((a) => a.kind === 'design-notes');
  return notes?.kind === 'design-notes' ? notes.sections : {};
}

export function diagramOf(content: SubmissionContent): string {
  const diagram = content.artifacts.find((a) => a.kind === 'class-diagram');
  return diagram?.kind === 'class-diagram' ? diagram.source : '';
}

export function buildContent(sections: NoteSections, diagram: string): SubmissionContent {
  return {
    artifacts: [
      { kind: 'design-notes', sections },
      { kind: 'class-diagram', format: 'mermaid', source: diagram },
    ],
  };
}
