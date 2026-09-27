import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { EvaluationWorker } from './app/evaluation-worker.ts';
import { PracticeService } from './app/practice-service.ts';
import { SubmissionEvaluator } from './app/submission-evaluator.ts';
import { loadConfig } from './config.ts';
import type { Evaluator } from './evaluation/evaluator.ts';
import { LlmRubricEvaluator } from './evaluation/llm-rubric-evaluator.ts';
import { EvaluationPipeline } from './evaluation/pipeline.ts';
import { RuleBasedEvaluator } from './evaluation/rule-evaluator.ts';
import { createApp } from './http/app.ts';
import { OpenRouterClient } from './llm/openrouter-client.ts';
import { AttemptRepository } from './persistence/attempt-repository.ts';
import { connectDatabase } from './persistence/db.ts';
import { SubmissionRepository } from './persistence/submission-repository.ts';

const config = loadConfig();
const log = (message: string) => console.log(`[designkata] ${message}`);
const db = await connectDatabase(config.mongoUri);
const submissions = new SubmissionRepository(db.models);

// The one place that decides who judges a design. A human reviewer would be one more line here.
const evaluators: Evaluator[] = [new RuleBasedEvaluator()];
if (config.llm) evaluators.push(new LlmRubricEvaluator(new OpenRouterClient(config.llm)));

const worker = new EvaluationWorker(
  submissions,
  new SubmissionEvaluator(submissions, new EvaluationPipeline(evaluators)),
  // The lease outlasts the slowest review (two structured calls, each with retries), so a live job is never stolen.
  { leaseMs: 10 * 60_000, pollMs: 3_000, concurrency: 2, log },
);
const practice = new PracticeService({ attempts: new AttemptRepository(db.models), submissions, worker });
const app = createApp({
  practice,
  log,
  health: () => ({
    ok: true,
    ai: config.llm ? { enabled: true, model: config.llm.model } : { enabled: false },
    database: db.description,
  }),
});
const server = http.createServer(app);

if (config.isDev) {
  // One process in development: Vite serves the React app with hot reload.
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true, hmr: { server } }, appType: 'spa' });
  app.use(vite.middlewares);
} else {
  const dist = path.resolve('web/dist');
  app.use(express.static(dist));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
}

server.listen(config.port, () => {
  const ai = config.llm ? `AI review on (${config.llm.model})` : 'AI review off (set OPENROUTER_API_KEY)';
  log(`running on http://localhost:${config.port}, ${db.description}, ${ai}`);
});
worker.start();

// Let running reviews finish, briefly. Anything unfinished is picked up again after restart.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    log(`${signal} received, shutting down`);
    server.close();
    await Promise.race([worker.stop(), new Promise((resolve) => setTimeout(resolve, 10_000))]);
    await db.close();
    process.exit(0);
  });
}
