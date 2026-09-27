import express, { type Request } from 'express';
import type { HealthDto } from '../../../shared/types.ts';
import type { PracticeService } from '../app/practice-service.ts';
import { errorHandler } from './errors.ts';
import {
  ContentBodySchema,
  IdempotencyKeySchema,
  LearnerIdSchema,
  StartAttemptSchema,
  SubmitSchema,
} from './validation.ts';

export interface AppDependencies {
  practice: PracticeService;
  health: () => HealthDto;
  log?: (message: string) => void;
}

// There are no accounts in the MVP: the browser keeps a random learner id and sends it on every call.
const learnerOf = (req: Request): string => LearnerIdSchema.parse(req.get('X-Learner-Id'));
const optionalLearnerOf = (req: Request): string | undefined => LearnerIdSchema.safeParse(req.get('X-Learner-Id')).data;

/** Routes only parse, delegate and shape the response. Decisions live in PracticeService. */
export function createApp({ practice, health, log }: AppDependencies): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY' });
    next();
  });
  app.use(express.json({ limit: '256kb' }));

  const api = express.Router();

  api.get('/health', (_req, res) => {
    res.json(health());
  });

  api.get('/problems', async (req, res) => {
    res.json(await practice.listProblems(optionalLearnerOf(req)));
  });

  api.get('/problems/:slug', (req, res) => {
    res.json(practice.getProblem(req.params.slug));
  });

  api.post('/problems/:slug/check', (req, res) => {
    const { content } = ContentBodySchema.parse(req.body);
    res.json({ findings: practice.checkStructure(req.params.slug, content) });
  });

  api.post('/attempts', async (req, res) => {
    const learnerId = learnerOf(req);
    const { problemSlug } = StartAttemptSchema.parse(req.body);
    res.status(201).json(await practice.startAttempt(learnerId, problemSlug));
  });

  api.get('/attempts', async (req, res) => {
    const problem = typeof req.query.problem === 'string' ? req.query.problem : undefined;
    res.json(await practice.listAttempts(learnerOf(req), problem));
  });

  api.get('/attempts/:id', async (req, res) => {
    res.json(await practice.getAttempt(learnerOf(req), req.params.id));
  });

  api.put('/attempts/:id/draft', async (req, res) => {
    const learnerId = learnerOf(req);
    const { content } = ContentBodySchema.parse(req.body);
    await practice.saveDraft(learnerId, req.params.id, content);
    res.status(204).end();
  });

  // 202: stored and queued for review. 200: this exact submit was already stored.
  api.post('/attempts/:id/submissions', async (req, res) => {
    const learnerId = learnerOf(req);
    const idempotencyKey = IdempotencyKeySchema.parse(req.get('Idempotency-Key'));
    const { content, twistId } = SubmitSchema.parse(req.body);
    const { submission, created } = await practice.submit(learnerId, req.params.id, {
      content,
      idempotencyKey,
      ...(twistId ? { twistId } : {}),
    });
    res.status(created ? 202 : 200).json(submission);
  });

  api.get('/submissions/:id', async (req, res) => {
    res.json(await practice.getSubmission(learnerOf(req), req.params.id));
  });

  api.post('/submissions/:id/retry', async (req, res) => {
    res.status(202).json(await practice.retry(learnerOf(req), req.params.id));
  });

  api.get('/progress', async (req, res) => {
    res.json(await practice.progress(learnerOf(req)));
  });

  api.use((_req, res) => {
    res.status(404).json({ error: { code: 'not-found', message: 'No such endpoint.' } });
  });

  app.use('/api', api);
  app.use(errorHandler(log));
  return app;
}
