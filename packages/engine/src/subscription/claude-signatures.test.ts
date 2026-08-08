import { describe, expect, test } from 'vitest';

import {
  antigravityClaudeSignature,
  nativeClaudeSignature,
  sanitizeClaudeSignatures,
  strictNativeClaudeSignature,
} from './claude-signatures';

function classicSignature(): string {
  const channel = Buffer.from([0x08, 0x0c]);
  const container = Buffer.concat([Buffer.from([0x0a, channel.length]), channel]);
  const payload = Buffer.concat([Buffer.from([0x12, container.length]), container]);

  return payload.toString('base64');
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

  test('accepts a strict signature between 16 KiB and 32 MiB', () => {
    const signature = strictSignature(20_000);

    expect(signature.length).toBeGreaterThan(16 * 1024);
    expect(antigravityClaudeSignature(signature)).not.toBeNull();
  });

  test('rejects a structurally valid signature over 32 MiB', () => {
    const signature = strictSignature(25 * 1024 * 1024);

    expect(signature.length).toBeGreaterThan(32 * 1024 * 1024);
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

describe('Claude signatures that are not text at all', () => {
  test.each([
    ['nothing', undefined],
    ['a number', 7],
    ['an object', { signature: 'x' }],
  ])('reads %s as no signature', (_label, value) => {
    expect(nativeClaudeSignature(value)).toBeNull();
    expect(strictNativeClaudeSignature(value)).toBeNull();
  });

  test('reads a foreign provider prefix as no strict signature', () => {
    expect(strictNativeClaudeSignature(`gemini#${classicSignature()}`)).toBeNull();
  });

  test('reads a Claude provider prefix through to the strict signature', () => {
    const signature = strictSignature(20_000);

    expect(strictNativeClaudeSignature(`ccmax#${signature}`)).toBe(signature);
  });
});

describe('Claude signature sanitation of content the wire did not shape', () => {
  test('a content entry that is not a block survives untouched', () => {
    const body = sanitizeClaudeSignatures({
      messages: [{ role: 'assistant', content: ['legacy text'] }],
    });

    expect(body['messages']).toEqual([{ role: 'assistant', content: ['legacy text'] }]);
  });

  test('a message whose content is not a list survives untouched', () => {
    const body = sanitizeClaudeSignatures({
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(body['messages']).toEqual([{ role: 'user', content: 'hello' }]);
  });

  test('a body without messages survives untouched', () => {
    const body = { model: 'claude-sonnet-4-5' };

    expect(sanitizeClaudeSignatures(body)).toBe(body);
  });
});

function strictSignature(channelSize: number): string {
  const channel = Buffer.alloc(channelSize, 0x6d);

  channel[0] = 0x08;

  const container = lengthDelimited(0x0a, channel);

  return lengthDelimited(0x12, container).toString('base64');
}

function lengthDelimited(tag: number, value: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), protobufVarint(value.length), value]);
}

function protobufVarint(value: number): Buffer {
  const bytes: number[] = [];
  let remaining = value;

  while (remaining >= 0x80) {
    bytes.push((remaining & 0x7f) | 0x80);
    remaining = Math.floor(remaining / 0x80);
  }

  bytes.push(remaining);

  return Buffer.from(bytes);
}
