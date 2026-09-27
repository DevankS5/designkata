import type { FeedbackReport, RecurringFindingDto, WeaknessDto } from '../../../shared/types.ts';
import { RUBRIC } from '../../../shared/rubric.ts';

// ponytail: "recent" means the last five reviews and "recurring" means twice;
// both are guesses to tune with real learners.
const WINDOW = 5;
const RECURRING = 2;

/** Criteria that were at level 1 or 2 in at least two of the learner's recent reviews. */
export function recurringWeaknesses(reports: readonly FeedbackReport[], window = WINDOW): WeaknessDto[] {
  const reviewed = reports.filter((r) => r.criteria.length > 0).slice(-window);
  if (reviewed.length < RECURRING) return [];

  return RUBRIC.map((criterion) => {
    const levels = reviewed.flatMap((r) => r.criteria.filter((c) => c.criterionId === criterion.id).map((c) => c.level));
    const averageLevel = levels.length ? levels.reduce((sum, level) => sum + level, 0) / levels.length : 0;
    return {
      criterionId: criterion.id,
      lowCount: levels.filter((level) => level <= 2).length,
      outOf: reviewed.length,
      averageLevel: Math.round(averageLevel * 10) / 10,
    };
  })
    .filter((w) => w.lowCount >= RECURRING)
    .sort((a, b) => b.lowCount - a.lowCount || a.averageLevel - b.averageLevel);
}

/** Rule warnings that keep coming back, such as a god class in every design. */
export function recurringFindings(reports: readonly FeedbackReport[], window = WINDOW): RecurringFindingDto[] {
  const recent = reports.slice(-window);
  const counts = new Map<string, { count: number; example: string }>();
  for (const report of recent) {
    const seen = new Set<string>();
    for (const finding of report.findings) {
      if (finding.severity !== 'warning' || seen.has(finding.ruleId)) continue;
      seen.add(finding.ruleId);
      const entry = counts.get(finding.ruleId) ?? { count: 0, example: finding.message };
      entry.count += 1;
      counts.set(finding.ruleId, entry);
    }
  }
  return [...counts.entries()]
    .filter(([, entry]) => entry.count >= RECURRING)
    .map(([ruleId, entry]) => ({ ruleId, count: entry.count, outOf: recent.length, example: entry.example }))
    .sort((a, b) => b.count - a.count);
}
