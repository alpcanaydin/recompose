import { describe, expect, test } from 'vitest';

import type { ResponsesInputItem } from './responses-wire';

import { encodeGeminiResponsesCarrier } from '../provider/gemini-responses-carrier';
import {
  foldResponsesInputWithGeminiCarriers,
  responsesItemForGeminiReasoningSignature,
} from './responses-gemini-carrier';

const CALL: ResponsesInputItem = {
  type: 'function_call',
  call_id: 'call_9',
  name: 'Read',
  arguments: '{}',
};

function nativeSignature(payload = Buffer.from([0x01, 0x0c, 0x39])): string {
  const inner = Buffer.concat([Buffer.from([0x0a, payload.length]), payload]);

  return Buffer.concat([Buffer.from([0x12, inner.length]), inner]).toString('base64');
}

function carrier(
  signature: string,
  direction: 'next' | 'previous',
  target: 'text' | 'function',
): ResponsesInputItem {
  return {
    type: 'reasoning',
    summary: [],
    content: null,
    encrypted_content: encodeGeminiResponsesCarrier({ signature, direction, target }),
  };
}

function assistantText(): { messages: { role: 'assistant'; content: [] }[]; fates: [] } {
  return { messages: [], fates: [] };
}

function folded(input: readonly ResponsesInputItem[], preserveDanglingCalls = false) {
  return foldResponsesInputWithGeminiCarriers(input, new Set<string>(), preserveDanglingCalls, () =>
    assistantText(),
  );
}

describe('recognizing a Gemini reasoning signature worth carrying', () => {
  test('a blank signature and a bypass marker both carry nothing', () => {
    expect(responsesItemForGeminiReasoningSignature('')).toBeNull();
    expect(responsesItemForGeminiReasoningSignature('skip_thought_signature_validator')).toBeNull();
  });
});

describe('folding a Gemini carrier the gateway cannot honor', () => {
  test('a marked carrier that decodes to nothing is dropped', () => {
    const item: ResponsesInputItem = {
      type: 'reasoning',
      summary: [],
      content: null,
      encrypted_content: 'cpa-gemini-responses-carrier-v1:sideways:text:AAAA',
    };

    const result = folded([item]);

    expect(result.messages).toStrictEqual([]);
    expect(result.fates).toStrictEqual([
      { field: 'encrypted_content', disposition: 'mapped', to: 'absent' },
    ]);
  });

  test('a carrier holding a signature Gemini would reject is dropped', () => {
    const result = folded([carrier('plain-sig', 'next', 'function'), CALL]);

    expect(result.fates).toContainEqual({
      field: 'encrypted_content',
      disposition: 'mapped',
      to: 'absent',
    });
  });

  test('a carrier with no call to attach itself to is dropped', () => {
    const result = folded([carrier(nativeSignature(), 'next', 'function')]);

    expect(result.messages).toStrictEqual([]);
    expect(result.fates).toStrictEqual([
      { field: 'encrypted_content', disposition: 'mapped', to: 'absent' },
    ]);
  });
});

describe('folding a Gemini carrier onto a call nobody answered', () => {
  test('the signature is carried but the dangling call is left out', () => {
    const result = folded([carrier(nativeSignature(), 'next', 'function'), CALL]);

    expect(result.messages).toStrictEqual([]);
    expect(result.fates).toStrictEqual([{ field: 'encrypted_content', disposition: 'carried' }]);
  });

  test('the call survives when dangling calls are preserved', () => {
    const result = foldResponsesInputWithGeminiCarriers(
      [carrier(nativeSignature(), 'next', 'function'), CALL],
      new Set<string>(),
      true,
      () => assistantText(),
    );

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toHaveProperty('content.0.signature', nativeSignature());
  });
});

describe('folding a Gemini carrier back onto the text it followed', () => {
  test('a previous-facing carrier signs the assistant text already folded', () => {
    const signature = nativeSignature();
    const result = foldResponsesInputWithGeminiCarriers(
      [CALL, carrier(signature, 'previous', 'text')],
      new Set(['call_9']),
      true,
      () => ({
        messages: [{ role: 'assistant', content: [{ type: 'text', text: 'hi' }] }],
        fates: [],
      }),
    );

    expect(result.fates).toContainEqual({ field: 'encrypted_content', disposition: 'carried' });
    expect(result.messages.at(-1)).toHaveProperty('content.0.signature', signature);
  });
});
