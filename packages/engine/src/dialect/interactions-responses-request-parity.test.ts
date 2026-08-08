import { describe, expect, it } from 'vitest';

import type { InteractionsRequest } from './interactions-wire';

import { translateRequest } from './dispatcher';
import { decodeRequest as decodeInteractions } from './interactions-request';
import { encodeRequest as encodeInteractions } from './interactions-request-encode';
import { decodeRequest as decodeResponses } from './responses-request';
import { encodeRequest as encodeResponses } from './responses-request-encode';
import { expectTranslation } from './responses.testkit';

describe('Responses tool results crossing Interactions', () => {
  it('should restore the function name and preserve a structured result', () => {
    const decoded = expectTranslation(
      decodeResponses({
        input: [
          { type: 'function_call', call_id: 'call_1', name: 'lookup', arguments: '{"q":"x"}' },
          { type: 'function_call_output', call_id: 'call_1', output: { ok: true } },
        ],
      }),
    );

    const encoded = encodeInteractions(decoded.value).value;

    expect(encoded.input).toContainEqual({
      type: 'function_result',
      call_id: 'call_1',
      name: 'lookup',
      result: { ok: true },
    });
  });
});

describe('Interactions tool results crossing Responses', () => {
  it('should preserve call identity and serialize a structured result once', () => {
    const decoded = decodeInteractions({
      input: [
        { type: 'function_call', call_id: 'call_1', name: 'lookup', arguments: { q: 'x' } },
        { type: 'function_result', call_id: 'call_1', name: 'lookup', result: { ok: true } },
      ],
    });

    const encoded = expectTranslation(encodeResponses(decoded.value));

    expect(encoded.value.input).toContainEqual({
      type: 'function_call_output',
      call_id: 'call_1',
      name: 'lookup',
      output: '{"ok":true}',
    });
  });
});

describe('Interactions expressible controls crossing Responses', () => {
  it('should carry supported controls and drop provider-specific execution fields', () => {
    const request: InteractionsRequest & {
      store: boolean;
      background: boolean;
      webhook_config: { url: string };
    } = {
      input: 'hi',
      tool_choice: { type: 'function', function: { name: 'lookup' } },
      response_modalities: ['text', 'image'],
      service_tier: 'priority',
      store: true,
      background: true,
      webhook_config: { url: 'https://example.test/hook' },
    };

    const translated = translateRequest('interactions', 'responses', request);

    expect(translated).toHaveProperty('value.tool_choice', { type: 'function', name: 'lookup' });
    expect(translated).toHaveProperty('value.modalities', ['text', 'image']);
    expect(translated).toHaveProperty('value.service_tier', 'priority');
    expect(translated).not.toHaveProperty('value.store');
    expect(translated).not.toHaveProperty('value.background');
    expect(translated).not.toHaveProperty('value.webhook_config');
  });
});
