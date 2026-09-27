import { z } from 'zod';

// Everything that arrives over HTTP is checked here, before it reaches the domain.

const SECTION_MAX = 6_000;
const DIAGRAM_MAX = 12_000;

const section = z.string().max(SECTION_MAX, `Keep each section under ${SECTION_MAX} characters.`).optional();

export const ContentSchema = z
  .object({
    artifacts: z
      .array(
        z.discriminatedUnion('kind', [
          z.object({
            kind: z.literal('design-notes'),
            sections: z
              .object({
                requirements: section,
                entities: section,
                flows: section,
                patterns: section,
                edgeCases: section,
                changeAnswer: section,
              })
              .strict(),
          }),
          z.object({
            kind: z.literal('class-diagram'),
            format: z.literal('mermaid'),
            source: z.string().max(DIAGRAM_MAX, `Keep the diagram under ${DIAGRAM_MAX} characters.`),
          }),
        ]),
      )
      .max(2),
  })
  .refine((content) => new Set(content.artifacts.map((a) => a.kind)).size === content.artifacts.length, {
    message: 'Send each kind of artifact at most once.',
  });

export const LearnerIdSchema = z.uuid({ message: 'Send a valid X-Learner-Id header (a UUID).' });

export const IdempotencyKeySchema = z
  .string({ message: 'Send an Idempotency-Key header so a retried submit cannot create a duplicate.' })
  .min(8, 'The Idempotency-Key header is too short.')
  .max(128, 'The Idempotency-Key header is too long.')
  .regex(/^[A-Za-z0-9_-]+$/, 'The Idempotency-Key header may only use letters, digits, - and _.');

export const StartAttemptSchema = z.object({ problemSlug: z.string().min(1).max(64) });
export const ContentBodySchema = z.object({ content: ContentSchema });
export const SubmitSchema = z.object({ content: ContentSchema, twistId: z.string().max(64).optional() });
