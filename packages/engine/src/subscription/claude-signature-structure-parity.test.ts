import { describe, expect, test } from 'vitest';

import { nativeGeminiSignature } from '../provider/gemini-signature';
import { inspectGeminiThoughtSignature } from '../provider/gemini-signature-inspection';
import {
  nativeClaudeSignature,
  sanitizeClaudeSignatures,
  strictNativeClaudeSignature,
} from './claude-signatures';

function varint(value: number): Buffer {
  const bytes: number[] = [];
  let remaining = value;

  while (remaining >= 0x80) {
    bytes.push((remaining & 0x7f) | 0x80);
    remaining = Math.floor(remaining / 0x80);
  }

  bytes.push(remaining);

  return Buffer.from(bytes);
}

function varintField(number: number, value: number): Buffer {
  return Buffer.concat([varint(number * 8), varint(value)]);
}

function bytesField(number: number, value: Uint8Array): Buffer {
  return Buffer.concat([varint(number * 8 + 2), varint(value.length), value]);
}

function classicSignature(): string {
  const channel = Buffer.concat([varintField(1, 12), varintField(2, 2)]);
  const container = bytesField(1, channel);
  const payload = Buffer.concat([bytesField(2, container), varintField(3, 1)]);

  return payload.toString('base64');
}

type CaisOptions = {
  channelId?: boolean;
  container?: boolean;
  model?: string;
  signatureBytes?: boolean;
};

function caisChannel(options: CaisOptions): Buffer {
  const channelFields: Buffer[] = [];

  if (options.channelId !== false) channelFields.push(varintField(1, 16));
  if (options.signatureBytes !== false) channelFields.push(bytesField(5, Buffer.alloc(64, 7)));

  if (options.model !== '') {
    channelFields.push(bytesField(6, Buffer.from(options.model ?? 'claude-opus-5')));
  }

  return Buffer.concat(channelFields);
}

function caisSignature(options: CaisOptions = {}): string {
  const container = bytesField(1, caisChannel(options));
  const topFields = [varintField(1, 2)];

  if (options.container !== false) topFields.push(bytesField(2, container));

  const payload = Buffer.concat(topFields);

  return payload.toString('base64');
}

function geminiFieldTwoSignature(): string {
  const providerPayload = Buffer.from([0x01, 0x0c, 0x39, 0xd6, 0xc7, 0x34]);

  return bytesField(2, bytesField(1, providerPayload)).toString('base64');
}

describe('strict Claude classic signature discrimination', () => {
  test('TestStripInvalidClaudeThinkingBlocks_StrictRemovesMalformedClaudeTree', () => {
    const malformed = Buffer.from([0x12, 0xff, 0xfe, 0xfd]).toString('base64');
    const body = sanitizeClaudeSignatures({
      messages: [
        {
          role: 'assistant',
          content: [
            { type: 'thinking', thinking: 'bad', signature: malformed },
            { type: 'text', text: 'Answer' },
          ],
        },
      ],
    });

    expect(strictNativeClaudeSignature(malformed)).toBeNull();
    expect(body).toHaveProperty('messages.0.content', [{ type: 'text', text: 'Answer' }]);
  });

  test('TestDetectSignatureProvider_Gemini3EPrefixDoesNotLookClaude', () => {
    const gemini = geminiFieldTwoSignature();

    expect(gemini.startsWith('E')).toBe(true);
    expect(strictNativeClaudeSignature(gemini)).toBeNull();
    expect(nativeGeminiSignature(gemini)).toBe(gemini);
  });
});

describe('strict Claude CAIS signature discrimination', () => {
  test('TestClaudeCAISSignature_RejectsMalformedPayloads', () => {
    expect(strictNativeClaudeSignature(caisSignature())).toBe(caisSignature());

    for (const signature of [
      caisSignature({ container: false }),
      caisSignature({ channelId: false }),
      caisSignature({ signatureBytes: false }),
      caisSignature({ model: '' }),
      caisSignature({ model: 'gemini-3-pro' }),
    ]) {
      expect(strictNativeClaudeSignature(signature)).toBeNull();
    }
  });

  test('TestGeminiEnvelopeNeverClaimsClaudeSignatures', () => {
    const classic = classicSignature();
    const cais = caisSignature();

    expect(strictNativeClaudeSignature(classic)).toBe(classic);
    expect(strictNativeClaudeSignature(cais)).toBe(cais);
    expect(inspectGeminiThoughtSignature(classic, { requireKnownEnvelope: true })).toBeNull();
    expect(inspectGeminiThoughtSignature(cais, { requireKnownEnvelope: true })).toBeNull();
  });
});

test('legacy Claude recognition remains permissive for cached E-form payloads', () => {
  const legacy = Buffer.from([0x12, 0x01, 0x00]).toString('base64');

  expect(nativeClaudeSignature(legacy)).toBe(legacy);
  expect(strictNativeClaudeSignature(legacy)).toBeNull();
});
