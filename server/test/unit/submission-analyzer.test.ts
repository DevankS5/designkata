import { describe, expect, it } from 'vitest';
import type { ArtifactReader } from '../../src/analysis/artifact-reader.ts';
import { SubmissionAnalyzer, defaultReaders } from '../../src/analysis/submission-analyzer.ts';
import type { DesignNotesArtifact } from '../../../shared/types.ts';

describe('SubmissionAnalyzer', () => {
  it('combines the notes and the diagram into one analysis', () => {
    const analysis = new SubmissionAnalyzer().analyze({
      artifacts: [
        { kind: 'design-notes', sections: { requirements: '  Park and unpark cars.  ', flows: '   ' } },
        { kind: 'class-diagram', format: 'mermaid', source: 'classDiagram\n  ParkingLot *-- Level' },
      ],
    });

    expect(analysis.sections).toEqual({ requirements: 'Park and unpark cars.' });
    expect(analysis.hasDiagram).toBe(true);
    expect(analysis.model.classes.map((c) => c.name)).toEqual(['ParkingLot', 'Level']);
    expect(analysis.text).toContain('Park and unpark cars.');
    expect(analysis.text).toContain('ParkingLot *-- Level');
  });

  it('passes reader diagnostics through', () => {
    const analysis = new SubmissionAnalyzer().analyze({
      artifacts: [{ kind: 'class-diagram', format: 'mermaid', source: 'classDiagram\n  Gate ==> Lot' }],
    });
    expect(analysis.diagnostics).toHaveLength(1);
    expect(analysis.diagnostics[0]!.line).toBe(2);
  });

  it('works with notes only', () => {
    const analysis = new SubmissionAnalyzer().analyze({
      artifacts: [{ kind: 'design-notes', sections: { entities: 'Vehicle, Spot, Ticket' } }],
    });
    expect(analysis.hasDiagram).toBe(false);
    expect(analysis.model.isEmpty).toBe(true);
  });

  it('routes each artifact to the reader registered for its kind', () => {
    const calls: string[] = [];
    const notes: ArtifactReader<DesignNotesArtifact> = {
      kind: 'design-notes',
      read: () => {
        calls.push('notes');
        return { diagnostics: [], text: 'from a custom reader' };
      },
    };
    const analysis = new SubmissionAnalyzer({ ...defaultReaders(), 'design-notes': notes }).analyze({
      artifacts: [{ kind: 'design-notes', sections: {} }],
    });

    expect(calls).toEqual(['notes']);
    expect(analysis.text).toBe('from a custom reader');
  });
});
