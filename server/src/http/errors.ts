import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorDto } from '../../../shared/types.ts';
import { DomainError, type DomainErrorCode } from '../domain/errors.ts';

const STATUS: Record<DomainErrorCode, number> = {
  validation: 400,
  'not-found': 404,
  conflict: 409,
  'rate-limited': 429,
};

const body = (code: string, message: string): ApiErrorDto => ({ error: { code, message } });

/** Turns any error into a JSON answer. Only expected errors show their message to the learner. */
export function errorHandler(log: (message: string) => void = console.error): ErrorRequestHandler {
  return (error: unknown, _req, res, _next) => {
    if (error instanceof DomainError) {
      res.status(STATUS[error.code]).json(body(error.code, error.message));
      return;
    }
    if (error instanceof ZodError) {
      const issue = error.issues[0];
      const where = issue?.path.length ? `${issue.path.map(String).join('.')}: ` : '';
      res.status(400).json(body('validation', `${where}${issue?.message ?? 'Invalid request.'}`));
      return;
    }
    const type = (error as { type?: string }).type;
    if (type === 'entity.too.large') {
      res.status(413).json(body('too-large', 'That is too large to submit. Shorten the notes or the diagram.'));
      return;
    }
    if (type === 'entity.parse.failed') {
      res.status(400).json(body('validation', 'The request body is not valid JSON.'));
      return;
    }
    log(`Unhandled error: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
    res.status(500).json(body('internal', 'Something went wrong on our side. Try again in a moment.'));
  };
}
