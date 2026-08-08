import { describe, expect, test } from 'vitest';

import type { ResponsesInputItem, ResponsesRequest } from './responses-wire';

import { encodeGeminiResponsesCarrier } from '../provider/gemini-responses-carrier';
import { responsesRequestForGemini } from './responses-gemini-request';

const prefill: ResponsesInputItem = {
  type: 'message',
  role: 'assistant',
  content: [{ type: 'output_text', text: 'Sure, ' }],
};

const question: ResponsesInputItem = {
  type: 'message',
  role: 'user',
  content: [{ type: 'input_text', text: 'carry on' }],
};

function reasoningHolding(encryptedContent: string): ResponsesInputItem {
  return { type: 'reasoning', summary: [], encrypted_content: encryptedContent };
}

function requestOf(...input: readonly ResponsesInputItem[]): ResponsesRequest {
  return { model: 'gemini-3-pro', input };
}

function inputKinds(request: ResponsesRequest): string[] {
  return request.input.map((item) => (item.type === 'message' ? item.role : item.type));
}

describe('an assistant prefill sent to a Gemini target', () => {
  test('a prefill standing behind opaque reasoning is dropped', () => {
    const request = requestOf(question, reasoningHolding('opaque-reasoning-blob'), prefill);

    expect(inputKinds(responsesRequestForGemini(request))).toStrictEqual(['user', 'reasoning']);
  });

  test('a prefill standing behind a carrier aimed at text is kept', () => {
    const carrier = encodeGeminiResponsesCarrier({
      signature: 'sig-1',
      direction: 'next',
      target: 'text',
    });
    const request = requestOf(question, reasoningHolding(carrier), prefill);

    expect(inputKinds(responsesRequestForGemini(request))).toContain('assistant');
  });

  test('a prefill standing behind a carrier aimed at a function is dropped', () => {
    const carrier = encodeGeminiResponsesCarrier({
      signature: 'sig-1',
      direction: 'next',
      target: 'function',
    });
    const request = requestOf(question, reasoningHolding(carrier), prefill);

    expect(inputKinds(responsesRequestForGemini(request))).not.toContain('assistant');
  });

  test('a prefill standing behind a backward carrier is dropped', () => {
    const carrier = encodeGeminiResponsesCarrier({
      signature: 'sig-1',
      direction: 'previous',
      target: 'text',
    });
    const request = requestOf(question, reasoningHolding(carrier), prefill);

    expect(inputKinds(responsesRequestForGemini(request))).not.toContain('assistant');
  });

  test('a prefill standing behind a carrier that will not decode is dropped', () => {
    const malformed = 'cpa-gemini-responses-carrier-v1:sideways:text:!!!';
    const request = requestOf(question, reasoningHolding(malformed), prefill);

    expect(inputKinds(responsesRequestForGemini(request))).not.toContain('assistant');
  });

  test('a prefill standing behind no reasoning at all is dropped', () => {
    expect(inputKinds(responsesRequestForGemini(requestOf(question, prefill)))).toStrictEqual([
      'user',
    ]);
  });

  test('a turn that ends on the user question is left alone', () => {
    expect(inputKinds(responsesRequestForGemini(requestOf(question)))).toStrictEqual(['user']);
  });
});
