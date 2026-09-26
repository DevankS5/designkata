import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { FakeLlmClient } from '../../src/llm/fake-llm-client.ts';
import type { LlmRequest } from '../../src/llm/llm-client.ts';
import { generateStructured, toStrictJsonSchema } from '../../src/llm/structured.ts';

const REQUEST: LlmRequest = {
  messages: [{ role: 'user', content: 'hi' }],
  schema: { name: 'answer', schema: { type: 'object' } },
};

describe('generateStructured', () => {
  const Answer = z.object({ level: z.number().int().min(1).max(4), reason: z.string() });

  it('returns validated JSON, even inside a code fence', async () => {
    const llm = new FakeLlmClient(['```json\n{"level": 3, "reason": "clear"}\n```']);
    await expect(generateStructured(llm, REQUEST.messages, 'answer', Answer)).resolves.toEqual({ level: 3, reason: 'clear' });
  });

  it('gives the model one chance to repair an invalid answer, with the exact error', async () => {
    const llm = new FakeLlmClient(['{"level": 7, "reason": "great"}', '{"level": 4, "reason": "great"}']);
    await expect(generateStructured(llm, REQUEST.messages, 'answer', Answer)).resolves.toEqual({ level: 4, reason: 'great' });

    const repair = llm.requests[1]!.messages.at(-1)!;
    expect(repair.role).toBe('user');
    expect(repair.content).toContain('level');
  });

  it('gives up after a failed repair', async () => {
    const llm = new FakeLlmClient(['not json', '{"level": "three"}']);
    await expect(generateStructured(llm, REQUEST.messages, 'answer', Answer)).rejects.toThrow('did not follow the answer format twice');
  });

  it('builds a strict schema with every property required', () => {
    const schema = toStrictJsonSchema(z.object({ a: z.string(), nested: z.object({ b: z.number() }) }));
    expect(schema).toMatchObject({
      type: 'object',
      required: ['a', 'nested'],
      additionalProperties: false,
      properties: { nested: { required: ['b'], additionalProperties: false } },
    });
    expect(schema).not.toHaveProperty('$schema');
  });
});
