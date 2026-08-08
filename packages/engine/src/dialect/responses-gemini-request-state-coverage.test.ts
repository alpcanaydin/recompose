import { describe, expect, it } from 'vitest';

import type { GeminiCarrier } from '../provider/gemini-responses-carrier';
import type { ResponsesInputItem, ResponsesRequest } from './responses-wire';

import { encodeGeminiResponsesCarrier } from '../provider/gemini-responses-carrier';
import { normalizeResponsesGeminiRequestState } from './responses-gemini-request-state';

const firstNativeSignature =
  'EjQKMgEMOdbHO0Gd+c9Mxk4ELwPGbpCEcp2mFfYYLix2UVtBH3fL8GECc4+JITVnHF4qZDsA';
const secondNativeSignature = 'EiYKJGUyNDgzMGE3LTVjZDYtNDJmZS05OThiLWVlNTM5ZTcyYjljMw==';

describe('normalizeResponsesGeminiRequestState leaves a marked carrier unbound', () => {
  it('keeps a carrier standing alone when it points at no particular target kind', () => {
    const normalized = normalizeResponsesGeminiRequestState(
      requestOf([
        markedReasoning({ signature: 'sig-any', direction: 'next', target: 'any' }),
        functionCall('call-1'),
      ]),
    );

    expect(normalized.input[0]).toEqual(reasoningWith('anthropic:sig-any'));
  });

  it('keeps a text carrier standing alone when a function call follows it', () => {
    const normalized = normalizeResponsesGeminiRequestState(
      requestOf([
        markedReasoning({ signature: 'sig-text', direction: 'next', target: 'text' }),
        functionCall('call-1'),
      ]),
    );

    expect(normalized.input[0]).toEqual(reasoningWith('anthropic:sig-text'));
  });
});

describe('normalizeResponsesGeminiRequestState leaves a raw carrier unbound', () => {
  it('keeps a raw carrier standing alone when only a user turn follows it', () => {
    const normalized = normalizeResponsesGeminiRequestState(
      requestOf([
        reasoningWith(firstNativeSignature),
        { type: 'message', role: 'user', content: 'and then?' },
      ]),
    );

    expect(normalized.input[0]).toEqual(reasoningWith(`anthropic:${firstNativeSignature}`));
  });
});

describe('normalizeResponsesGeminiRequestState moves a raw signature onto its call', () => {
  it('drops a wordless carrier once its signature sits on the call', () => {
    const normalized = normalizeResponsesGeminiRequestState(
      requestOf([
        { type: 'reasoning', encrypted_content: firstNativeSignature },
        functionCall('call-1'),
      ]),
    );

    expect(normalized.input).toEqual([
      reasoningWith(canonicalCarrierFor(firstNativeSignature)),
      functionCall('call-1'),
    ]);
  });
});

describe('normalizeResponsesGeminiRequestState signs a call once', () => {
  it('leaves the trailing raw carrier standing alone when the call is already signed', () => {
    const normalized = normalizeResponsesGeminiRequestState(
      requestOf([
        reasoningWith(firstNativeSignature),
        functionCall('call-1'),
        reasoningWith(secondNativeSignature),
        functionOutput('call-1'),
      ]),
    );

    expect(normalized.input).toEqual([
      reasoningWith(canonicalCarrierFor(firstNativeSignature)),
      functionCall('call-1'),
      reasoningWith(`anthropic:${secondNativeSignature}`),
      functionOutput('call-1'),
    ]);
  });
});

// Helpers

function requestOf(input: readonly ResponsesInputItem[]): ResponsesRequest {
  return { model: 'gemini-3.5-pro', input };
}

function reasoningWith(encryptedContent: string): ResponsesInputItem {
  return { type: 'reasoning', summary: [], content: null, encrypted_content: encryptedContent };
}

function markedReasoning(carrier: GeminiCarrier): ResponsesInputItem {
  return reasoningWith(encodeGeminiResponsesCarrier(carrier));
}

function canonicalCarrierFor(signature: string): string {
  return encodeGeminiResponsesCarrier({ signature, direction: 'next', target: 'function' });
}

function functionCall(callId: string): ResponsesInputItem {
  return { type: 'function_call', call_id: callId, name: 'run_command', arguments: '{}' };
}

function functionOutput(callId: string): ResponsesInputItem {
  return { type: 'function_call_output', call_id: callId, output: 'ok' };
}
