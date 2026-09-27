import type { Artifact, ArtifactKind, NoteSections } from '../../../shared/types.ts';
import type { DesignModel } from '../domain/design-model.ts';

export interface Diagnostic {
  line: number;
  severity: 'error' | 'warning';
  message: string;
}

/** What one artifact contributes to the analysis of a submission. */
export interface ArtifactReading {
  model?: DesignModel;
  sections?: NoteSections;
  diagnostics: Diagnostic[];
  /** Plain text of the artifact, used to check that quoted evidence really exists. */
  text: string;
}

/** Turns one kind of artifact into structured data. One reader per submission format. */
export interface ArtifactReader<A extends Artifact = Artifact> {
  readonly kind: A['kind'];
  read(artifact: A): ArtifactReading;
}

/** Exactly one reader per artifact kind. Adding a kind without a reader is a compile error. */
export type ReaderRegistry = { [K in ArtifactKind]: ArtifactReader<Extract<Artifact, { kind: K }>> };
