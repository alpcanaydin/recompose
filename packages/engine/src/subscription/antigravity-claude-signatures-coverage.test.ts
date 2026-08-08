import { describe, expect, test } from 'vitest';

import type { JsonObject } from '../gateway-wire';

import { sanitizeAntigravityClaudeSignatures } from './antigravity-claude-signatures';

function claudeSignature(): string {
  const channel = Buffer.from([0x08, 0x0c]);
  const container = Buffer.concat([Buffer.from([0x0a, channel.length]), channel]);

  return Buffer.concat([Buffer.from([0x12, container.length]), container]).toString('base64');
}

function sanitizedParts(parts: readonly unknown[]): unknown {
  const request: JsonObject = { contents: [{ role: 'model', parts }] };

  sanitizeAntigravityClaudeSignatures(request, 'claude-sonnet-4-6');

  return request['contents'];
}

const untouchedContents: [string, unknown][] = [
  ['a content entry that is not a record', 'plain'],
  ['a content entry without a parts list', { role: 'user' }],
  ['a content entry whose parts are not a list', { role: 'user', parts: 'text' }],
];

describe('a Claude thought keeps only a signature Claude can read', () => {
  test('a usable signature is re-encoded for the Antigravity wire', () => {
    const signature = claudeSignature();
    const contents = sanitizedParts([{ thought: true, text: 'why', thoughtSignature: signature }]);

    expect(contents).toEqual([
      {
        role: 'model',
        parts: [
          {
            thought: true,
            text: 'why',
            thoughtSignature: Buffer.from(signature).toString('base64'),
          },
        ],
      },
    ]);
  });

  test('a foreign signature drops the thought and the content it was alone in', () => {
    const contents = sanitizedParts([
      { thought: true, text: 'why', thoughtSignature: 'gAAAA-openai-encrypted-content' },
    ]);

    expect(contents).toEqual([]);
  });

  test('an empty thought is dropped while its siblings survive', () => {
    const contents = sanitizedParts([
      { thought: true, text: '', thoughtSignature: claudeSignature() },
      { text: 'kept' },
    ]);

    expect(contents).toEqual([{ role: 'model', parts: [{ text: 'kept' }] }]);
  });
});

describe('a Claude function call carries no thought signature', () => {
  test('both spellings are stripped from the part and from the call', () => {
    const contents = sanitizedParts([
      {
        thoughtSignature: 'outer',
        thought_signature: 'outer-snake',
        functionCall: {
          name: 'read',
          thoughtSignature: 'inner',
          thought_signature: 'inner-snake',
        },
      },
    ]);

    expect(contents).toEqual([{ role: 'model', parts: [{ functionCall: { name: 'read' } }] }]);
  });

  test('a call that never carried a signature is handed back whole', () => {
    const contents = sanitizedParts([{ functionCall: { name: 'read', args: { path: 'a.md' } } }]);

    expect(contents).toEqual([
      { role: 'model', parts: [{ functionCall: { name: 'read', args: { path: 'a.md' } } }] },
    ]);
  });
});

describe('a part the sanitizer does not own survives untouched', () => {
  test('a part that is not a record is left alone', () => {
    expect(sanitizedParts(['plain', 7])).toEqual([{ role: 'model', parts: ['plain', 7] }]);
  });

  test('a part that is not marked as a thought keeps its signature', () => {
    expect(sanitizedParts([{ text: 'hi', thoughtSignature: 'foreign' }])).toEqual([
      { role: 'model', parts: [{ text: 'hi', thoughtSignature: 'foreign' }] },
    ]);
  });
});

describe('a request the sanitizer does not own is left alone', () => {
  test('a request for a Gemini model keeps every signature', () => {
    const request: JsonObject = {
      contents: [{ role: 'model', parts: [{ thought: true, text: 't', thoughtSignature: 'x' }] }],
    };

    sanitizeAntigravityClaudeSignatures(request, 'gemini-3.6-flash');

    expect(request).toHaveProperty('contents.0.parts.0.thoughtSignature', 'x');
  });

  test('a request whose contents are not a list is left alone', () => {
    const request: JsonObject = { contents: 'not a list' };

    sanitizeAntigravityClaudeSignatures(request, 'claude-sonnet-4-6');

    expect(request['contents']).toBe('not a list');
  });

  test.each(untouchedContents)('%s survives untouched', (_label, content) => {
    const request: JsonObject = { contents: [content] };

    sanitizeAntigravityClaudeSignatures(request, 'claude-sonnet-4-6');

    expect(request['contents']).toEqual([content]);
  });
});
