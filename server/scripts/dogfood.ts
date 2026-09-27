// DesignKata reviews its own design: the domain diagram in docs/diagrams/domain.mmd
// goes through the same deterministic rules a learner's design does.
// Usage: npm run dogfood
import { readFileSync } from 'node:fs';
import { SubmissionAnalyzer } from '../src/analysis/submission-analyzer.ts';
import type { Problem } from '../src/domain/problem.ts';
import { RuleBasedEvaluator } from '../src/evaluation/rule-evaluator.ts';

// The assignment itself, written as a DesignKata problem.
const platform: Problem = {
  slug: 'lld-practice-platform',
  title: 'LLD Practice Platform',
  difficulty: 'Hard',
  timeboxMinutes: 60,
  summary: 'Practise LLD, submit, get explainable feedback, see history.',
  context: 'The CipherSchools assignment.',
  requirements: ['Problems', 'Practice', 'Submission with status', 'Feedback', 'History', 'Clear core classes'],
  outOfScope: ['Microservices', 'Multi-region deployment'],
  concepts: [
    { name: 'Problem', synonyms: ['problem'] },
    { name: 'Attempt', synonyms: ['attempt'] },
    { name: 'Submission', synonyms: ['submission'] },
    { name: 'Evaluation', synonyms: ['evaluation'] },
    { name: 'Evaluator', synonyms: ['evaluator'] },
  ],
  variationPoints: [
    { id: 'format', name: 'Submission format', why: 'text today, diagrams or code later', synonyms: ['reader', 'parser'], suggestion: '' },
    { id: 'judge', name: 'Evaluation approach', why: 'rules, an LLM, a human reviewer', synonyms: ['evaluator', 'judge'], suggestion: '' },
    { id: 'model', name: 'Model provider', why: 'providers and models change', synonyms: ['llmclient', 'client'], suggestion: '' },
  ],
  edgeCases: [
    { id: 'duplicate', description: 'The same submit arrives twice.', keywords: ['idempot', 'duplicate', 'double'] },
    { id: 'slow', description: 'The review takes long.', keywords: ['background', 'worker', 'async'] },
    { id: 'failure', description: 'The reviewer fails.', keywords: ['fail'] },
    { id: 'crash', description: 'The process dies mid-review.', keywords: ['lease', 'crash'] },
  ],
  acceptedVariants: [],
  twist: { id: 'human-review', title: 'Human review', prompt: 'Add human reviewers.' },
  starterDiagram: '',
};

const notes = {
  requirements: 'Learners pick a problem, write notes and a class diagram, submit, read feedback, revise or take the twist, and see their history.',
  entities: 'PracticeService runs the use cases. Attempt owns the draft and versioning; Submission is immutable and owns its Evaluation state machine.',
  flows: 'Submit stores the submission with its evaluation queued, then the EvaluationWorker claims it in the background and runs the pipeline.',
  patterns: 'Evaluator, ArtifactReader and LlmClient are interfaces because each already has two implementations. Repositories are concrete.',
  edgeCases: 'A double submit is idempotent. A failed review keeps the rule findings. A crashed worker loses its lease and the job is claimed again.',
};

const source = readFileSync(new URL('../../docs/diagrams/domain.mmd', import.meta.url), 'utf8');
const analysis = new SubmissionAnalyzer().analyze({
  artifacts: [
    { kind: 'design-notes', sections: notes },
    { kind: 'class-diagram', format: 'mermaid', source },
  ],
});
const findings = new RuleBasedEvaluator().check({ problem: platform, analysis, findings: [] });

console.log(`${analysis.model.classes.length} classes, ${analysis.model.relationships.length} relationships, ${analysis.diagnostics.length} diagram warnings.`);
if (findings.length === 0) console.log('No findings.');
for (const f of findings) console.log(`[${f.severity}] ${f.ruleId}: ${f.message}`);
