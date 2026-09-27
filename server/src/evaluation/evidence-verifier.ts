import type { AnalyzedSubmission } from '../analysis/submission-analyzer.ts';

const normalize = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Checks that a quote the reviewer attributes to the learner really appears in
 * what the learner wrote. Case, punctuation and spacing are ignored, and a
 * quote shortened with "..." must match piece by piece. Paraphrases fail on
 * purpose: feedback that cannot point at the learner's own words is weaker.
 */
export class EvidenceVerifier {
  verify(quote: string, analysis: AnalyzedSubmission): boolean {
    // Padded with spaces so only whole words match: "spot" is not found inside "parkingspot".
    const haystack = ` ${normalize(analysis.text)} `;
    const pieces = quote
      .split(/\.\.\.|…/)
      .map(normalize)
      .filter((piece) => piece.length >= 3);
    return pieces.length > 0 && pieces.every((piece) => haystack.includes(` ${piece} `));
  }
}
