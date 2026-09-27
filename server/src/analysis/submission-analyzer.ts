import type { Artifact, ArtifactKind, NoteSections, SubmissionContent } from '../../../shared/types.ts';
import { DesignModel } from '../domain/design-model.ts';
import type { ArtifactReader, ArtifactReading, Diagnostic, ReaderRegistry } from './artifact-reader.ts';
import { MermaidClassDiagramReader } from './mermaid-reader.ts';
import { DesignNotesReader } from './notes-reader.ts';

/** Everything the evaluators need to know about one submission, independent of its format. */
export interface AnalyzedSubmission {
  model: DesignModel;
  sections: NoteSections;
  diagnostics: Diagnostic[];
  /** All text the learner wrote. Quoted evidence must be found in here. */
  text: string;
  /** The raw text of each artifact, for showing a reviewer exactly what was submitted. */
  artifacts: { kind: ArtifactKind; text: string }[];
  hasDiagram: boolean;
}

export const defaultReaders = (): ReaderRegistry => ({
  'design-notes': new DesignNotesReader(),
  'class-diagram': new MermaidClassDiagramReader(),
});

export class SubmissionAnalyzer {
  private readonly readers: ReaderRegistry;

  constructor(readers: ReaderRegistry = defaultReaders()) {
    this.readers = readers;
  }

  analyze(content: SubmissionContent): AnalyzedSubmission {
    let model = DesignModel.empty();
    let hasDiagram = false;
    const sections: NoteSections = {};
    const diagnostics: Diagnostic[] = [];
    const artifacts: AnalyzedSubmission['artifacts'] = [];

    for (const artifact of content.artifacts) {
      const reading = this.read(artifact);
      if (reading.model) {
        model = reading.model;
        hasDiagram = true;
      }
      Object.assign(sections, reading.sections);
      diagnostics.push(...reading.diagnostics);
      artifacts.push({ kind: artifact.kind, text: reading.text });
    }

    const text = artifacts.map((a) => a.text).join('\n\n');
    return { model, sections, diagnostics, text, artifacts, hasDiagram };
  }

  private read<A extends Artifact>(artifact: A): ArtifactReading {
    // The registry type guarantees this reader handles exactly this kind of artifact.
    const reader = this.readers[artifact.kind] as unknown as ArtifactReader<A>;
    return reader.read(artifact);
  }
}
