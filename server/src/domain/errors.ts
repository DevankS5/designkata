export type DomainErrorCode = 'validation' | 'not-found' | 'conflict' | 'rate-limited';

/** An expected failure with a message that is safe to show the learner. The HTTP layer maps the code to a status. */
export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}
