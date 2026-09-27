// The data contract shared by the server and the web app.
// Only shapes live here. Behaviour lives in server/src/domain.

// ---------- What a learner submits ----------

export const NOTE_SECTIONS = ['requirements', 'entities', 'flows', 'patterns', 'edgeCases'] as const;
export type CoreNoteSection = (typeof NOTE_SECTIONS)[number];
/** changeAnswer is only asked for when the learner takes the twist. */
export type NoteSectionId = CoreNoteSection | 'changeAnswer';
export type NoteSections = Partial<Record<NoteSectionId, string>>;

export interface DesignNotesArtifact {
  kind: 'design-notes';
  sections: NoteSections;
}

export interface ClassDiagramArtifact {
  kind: 'class-diagram';
  format: 'mermaid';
  source: string;
}

/** One piece of evidence in a submission. A new format (code, a drawn diagram) is a new member here. */
export type Artifact = DesignNotesArtifact | ClassDiagramArtifact;
export type ArtifactKind = Artifact['kind'];

export interface SubmissionContent {
  artifacts: Artifact[];
}

// ---------- How it is judged ----------

export type CriterionId =
  | 'requirements'
  | 'responsibilities'
  | 'coupling'
  | 'extensibility'
  | 'behaviour'
  | 'tradeoffs';

export type Level = 1 | 2 | 3 | 4;
export type Confidence = 'low' | 'medium' | 'high';
export type Severity = 'info' | 'warning';

export interface CriterionDefinition {
  id: CriterionId;
  name: string;
  question: string;
  levels: Record<Level, string>;
}

/** A deterministic signal from a rule. Signals point at evidence; they are never a grade. */
export interface Finding {
  ruleId: string;
  severity: Severity;
  message: string;
  suggestion: string;
  criterionId?: CriterionId;
  evidence?: string;
}

export interface Evidence {
  quote: string;
  /** True when the quote was found in the learner's own submission. */
  verified: boolean;
}

export interface CriterionFeedback {
  criterionId: CriterionId;
  level: Level;
  evidence: Evidence[];
  strength: string;
  concern: string;
  suggestion: string;
  confidence: Confidence;
}

export interface ClassChange {
  name: string;
  added: string[];
  removed: string[];
}

/** How much of the previous design had to change. Existing classes touched = blast radius. */
export interface ChangeImpact {
  addedClasses: string[];
  removedClasses: string[];
  modifiedClasses: ClassChange[];
  addedRelationships: string[];
  removedRelationships: string[];
  blastRadius: number;
  label: 'additive' | 'localized' | 'wide';
}

export type AiReviewState = 'pending' | 'completed' | 'failed' | 'not-configured';

export interface EvaluatorRun {
  evaluator: string;
  status: 'completed' | 'failed';
  durationMs: number;
  error?: string;
}

export interface FeedbackReport {
  findings: Finding[];
  criteria: CriterionFeedback[];
  strengths: string[];
  summary?: string;
  nextFocus?: { criterionId: CriterionId; action: string };
  changeImpact?: ChangeImpact;
  evidence: { verified: number; total: number };
  ai: { state: AiReviewState; model?: string };
  runs: EvaluatorRun[];
}

export type EvaluationStatus = 'SUBMITTED' | 'EVALUATING' | 'COMPLETED' | 'FAILED';

// ---------- The HTTP API ----------

export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type LevelMap = Partial<Record<CriterionId, Level>>;

export interface ProblemSummaryDto {
  slug: string;
  title: string;
  difficulty: Difficulty;
  timeboxMinutes: number;
  summary: string;
  origin?: string;
  attempts: number;
  latestLevels?: LevelMap;
}

export interface ProblemDto {
  slug: string;
  title: string;
  difficulty: Difficulty;
  timeboxMinutes: number;
  summary: string;
  context: string;
  origin?: string;
  requirements: string[];
  outOfScope: string[];
  edgeCases: string[];
  starterDiagram: string;
  sample?: SubmissionContent;
  twist: { id: string; title: string; prompt: string };
}

export interface SubmissionSummaryDto {
  id: string;
  version: number;
  twistId?: string;
  createdAt: string;
  status: EvaluationStatus;
  levels: LevelMap;
}

export interface AttemptDto {
  id: string;
  problemSlug: string;
  draft: SubmissionContent;
  createdAt: string;
  updatedAt: string;
  submissions: SubmissionSummaryDto[];
  /** The twist unlocks once the latest version has been reviewed. */
  twistUnlocked: boolean;
}

export interface SubmissionDto {
  id: string;
  attemptId: string;
  problemSlug: string;
  version: number;
  twistId?: string;
  createdAt: string;
  content: SubmissionContent;
  evaluation: {
    status: EvaluationStatus;
    tries: number;
    canRetry: boolean;
    error?: string;
    report?: FeedbackReport;
  };
  previousLevels?: LevelMap;
}

export interface WeaknessDto {
  criterionId: CriterionId;
  /** In how many of the recent reviews this criterion was at level 1 or 2. */
  lowCount: number;
  outOf: number;
  averageLevel: number;
}

export interface RecurringFindingDto {
  ruleId: string;
  count: number;
  outOf: number;
  example: string;
}

export interface ProgressDto {
  reviewed: number;
  weaknesses: WeaknessDto[];
  recurringFindings: RecurringFindingDto[];
  history: { problemSlug: string; title: string; attemptId: string; versions: SubmissionSummaryDto[] }[];
}

export interface HealthDto {
  ok: boolean;
  ai: { enabled: boolean; model?: string };
  database: string;
}

export interface ApiErrorDto {
  error: { code: string; message: string };
}
