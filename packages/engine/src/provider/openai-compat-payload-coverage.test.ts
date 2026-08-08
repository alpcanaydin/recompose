import { describe, expect, test } from 'vitest';

import {
  applyOpenAICompatPayloadOverride,
  ensureColonSpacedJSON,
  normalizeKimiToolMessageLinksRaw,
} from './openai-compat-payload';

function text(payload: Uint8Array): string {
  return new TextDecoder().decode(payload);
}

function bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

describe('spacing a JSON payload the way an OpenAI-compatible provider expects', () => {
  test('a valid payload gains a space after every key separator', () => {
    expect(text(ensureColonSpacedJSON(bytes('{"model":"kimi","stream":true}')))).toBe(
      '{"model": "kimi","stream": true}',
    );
  });

  test('a payload that is not JSON passes through untouched', () => {
    const payload = bytes('not json at all');

    expect(ensureColonSpacedJSON(payload)).toBe(payload);
  });
});

describe('linking Kimi tool messages back to the call they answer', () => {
  test('a payload that already links its tool messages is left alone', () => {
    const payload = '{"messages":[{"role":"tool","tool_call_id":"call_1","content":"done"}]}';

    expect(normalizeKimiToolMessageLinksRaw(payload)).toBe(payload);
  });

  test('a payload naming the call under the Responses spelling is relinked', () => {
    const payload = '{"messages":[{"role":"tool","call_id":"call_1","content":"done"}]}';

    expect(normalizeKimiToolMessageLinksRaw(payload)).toContain('"tool_call_id":"call_1"');
  });

  test('assistant text before a tool call is echoed as reasoning content', () => {
    const payload = '{"messages":[{"content":"thinking","tool_calls":[]}]}';

    expect(normalizeKimiToolMessageLinksRaw(payload)).toContain('"reasoning_content":"thinking"');
  });
});

describe('folding a caller payload override into the provider request', () => {
  test('a request without an override passes through untouched', () => {
    const body = { model: 'kimi' };

    expect(applyOpenAICompatPayloadOverride(body)).toBe(body);
  });

  test('an override that is not an object passes through untouched', () => {
    const body = { model: 'kimi', provider_payload_override: 'nonsense' };

    expect(applyOpenAICompatPayloadOverride(body)).toBe(body);
  });

  test('an override replaces the fields it names and leaves the marker behind', () => {
    expect(
      applyOpenAICompatPayloadOverride({
        model: 'kimi',
        stream: true,
        provider_payload_override: { model: 'kimi-thinking' },
      }),
    ).toEqual({ model: 'kimi-thinking', stream: true });
  });
});
