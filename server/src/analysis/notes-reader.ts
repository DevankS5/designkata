import type { DesignNotesArtifact, NoteSections } from '../../../shared/types.ts';
import type { ArtifactReader, ArtifactReading } from './artifact-reader.ts';

/** Keeps the sections a learner actually filled in, trimmed. Blank sections are dropped. */
export class DesignNotesReader implements ArtifactReader<DesignNotesArtifact> {
  readonly kind = 'design-notes' as const;

  read(artifact: DesignNotesArtifact): ArtifactReading {
    const sections: NoteSections = {};
    for (const [id, text] of Object.entries(artifact.sections) as [keyof NoteSections, string | undefined][]) {
      const trimmed = text?.trim();
      if (trimmed) sections[id] = trimmed;
    }
    return { sections, diagnostics: [], text: Object.values(sections).join('\n\n') };
  }
}
