import { z } from 'zod';
import { LlmError, type LlmClient, type LlmMessage } from './llm-client.ts';

/**
 * Asks for JSON that matches the schema. If the answer does not parse or does
 * not validate, the model gets one chance to repair it, with the exact error.
 */
export async function generateStructured<T>(
  client: LlmClient,
  messages: LlmMessage[],
  schemaName: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const jsonSchema = { name: schemaName, schema: toStrictJsonSchema(schema) };
  const first = await client.complete({ messages, schema: jsonSchema });
  const firstTry = parse(first, schema);
  if (firstTry.ok) return firstTry.value;

  const repaired = await client.complete({
    schema: jsonSchema,
    messages: [
      ...messages,
      { role: 'assistant', content: first },
      {
        role: 'user',
        content: `That answer is not valid: ${firstTry.error}. Reply again with only the corrected JSON, matching the schema exactly.`,
      },
    ],
  });
  const secondTry = parse(repaired, schema);
  if (secondTry.ok) return secondTry.value;
  throw new LlmError(`The AI reviewer did not follow the answer format twice (${secondTry.error}).`, false);
}

function parse<T>(text: string, schema: z.ZodType<T>): { ok: true; value: T } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(stripCodeFence(text));
  } catch {
    return { ok: false, error: 'it is not valid JSON' };
  }
  const result = schema.safeParse(json);
  if (result.success) return { ok: true, value: result.data };
  const issue = result.error.issues[0];
  const path = issue?.path.map(String).join('.') || 'answer';
  return { ok: false, error: `${path}: ${issue?.message ?? 'does not match the schema'}` };
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return fenced ? fenced[1]! : trimmed;
}

/** JSON schema for providers' strict mode: every property required, no extra properties. */
export function toStrictJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: 'draft-7', io: 'output' }) as Record<string, unknown>;
  delete json.$schema;
  return tighten(json) as Record<string, unknown>;
}

function tighten(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(tighten);
  if (!node || typeof node !== 'object') return node;
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) copy[key] = tighten(value);
  if (copy.type === 'object' && copy.properties && typeof copy.properties === 'object') {
    copy.required = Object.keys(copy.properties);
    copy.additionalProperties = false;
  }
  return copy;
}
