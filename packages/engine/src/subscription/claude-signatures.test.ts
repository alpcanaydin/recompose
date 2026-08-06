import { describe, expect, test } from 'vitest';

import { nativeClaudeSignature, sanitizeClaudeSignatures } from './claude-signatures';

function classicSignature(): string {
  return Buffer.from([0x12, 0x01, 0x00]).toString('base64');
}

describe('Claude signature compatibility', () => {
  test('accepts native E form, unwraps R form, and strips a known cache prefix', () => {
    const native = classicSignature();
    const wrapped = Buffer.from(native).toString('base64');

    expect(nativeClaudeSignature(native)).toBe(native);
    expect(nativeClaudeSignature(wrapped)).toBe(native);
    expect(nativeClaudeSignature(`claude#${native}`)).toBe(native);
  });

  test.each([
    '',
    'gAAAA-openai-encrypted-content',
    'E-not-base64',
    Buffer.from([0x13, 0x01]).toString('base64'),
    `gemini#${classicSignature()}`,
  ])('rejects a foreign or malformed signature: %s', (signature) => {
    expect(nativeClaudeSignature(signature)).toBeNull();
  });
});

describe('Claude signature request sanitation', () => {
  test('drops incompatible thinking, cleans tool signatures, and removes empty messages', () => {
    const valid = classicSignature();
    const body = sanitizeClaudeSignatures({
      messages: [
        {
          role: 'assistant',
          content: [{ type: 'thinking', thinking: 'foreign', signature: 'gAAAA-invalid' }],
        },
        {
          role: 'assistant',
          content: [
            { type: 'thinking', thinking: 'valid', signature: valid },
            {
              type: 'tool_use',
              id: 'one',
              name: 'Bash',
              input: {},
              signature: 'bad',
              thoughtSignature: 'bad-too',
              model: 'foreign-model',
            },
          ],
        },
      ],
    });

    expect(body['messages']).toEqual([
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'valid', signature: valid },
          { type: 'tool_use', id: 'one', name: 'Bash', input: {} },
        ],
      },
    ]);
  });
});
