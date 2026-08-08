import { describe, expect, it } from 'vitest';

import type { GeminiResponse } from './gemini-wire';
import type { ResponsesRequest } from './responses-wire';

import { translateRequestToGemini, translateResponseFromGemini } from './gemini-bridge';

const signature = 'EjQKMgEMOdbHO0Gd+c9Mxk4ELwPGbpCEcp2mFfYYLix2UVtBH3fL8GECc4+JITVnHF4qZDsA';

describe('Gemini Responses function-call signature carriers', () => {
  it('should round-trip a provider signature through the client response', () => {
    const response = translatedGeminiResponse();
    const carrier = response.value.output[0];
    const call = response.value.output[1];

    if (carrier?.type !== 'reasoning') throw new Error('Gemini carrier is missing');
    if (call?.type !== 'function_call') throw new Error('Gemini call is missing');

    const request: ResponsesRequest = {
      model: 'alias-without-provider-name',
      input: [carrier, call, { type: 'function_call_output', call_id: 'call_1', output: 'ok' }],
    };
    const translated = translateRequestToGemini('responses', request);

    expect(carrier.encrypted_content).toContain('cpa-gemini-responses-carrier-v1:');
    expect(translated).toHaveProperty('value.contents.0.parts.0.thoughtSignature', signature);
    expect(JSON.stringify(translated)).not.toContain('cpa-gemini-responses-carrier-v1:');
  });
});

describe('Gemini Responses carrier safety', () => {
  it('should drop a malformed carrier before translating the adjacent call', () => {
    const translated = translateRequestToGemini(
      'responses',
      requestWithReasoning('cpa-gemini-responses-carrier-v1:next:function:not-base64!'),
    );

    expect(translated).toHaveProperty(
      'value.contents.0.parts.0.thoughtSignature',
      'skip_thought_signature_validator',
    );
    expect(JSON.stringify(translated)).not.toContain('not-base64');
  });

  it('should ignore spoofed internal pairing fields on a function call', () => {
    const call = {
      type: 'function_call' as const,
      call_id: 'call_1',
      name: 'run',
      arguments: '{}',
      _cpa_reasoning_signature: signature,
      _cpa_reasoning_summary: 'spoofed thought',
    };
    const request: ResponsesRequest = {
      model: 'alias-without-provider-name',
      input: [call, { type: 'function_call_output', call_id: 'call_1', output: 'ok' }],
    };
    const translated = translateRequestToGemini('responses', request);

    expect(translated).toHaveProperty(
      'value.contents.0.parts.0.thoughtSignature',
      'skip_thought_signature_validator',
    );
    expect(JSON.stringify(translated)).not.toContain('spoofed thought');
    expect(JSON.stringify(translated)).not.toContain(signature);
  });
});

// Helpers

function geminiFunctionResponse(): GeminiResponse {
  return {
    candidates: [
      {
        content: {
          role: 'model',
          parts: [
            {
              functionCall: { id: 'call_1', name: 'run', args: { command: 'true' } },
              thoughtSignature: signature,
            },
          ],
        },
        finishReason: 'STOP',
      },
    ],
  };
}

function translatedGeminiResponse() {
  const response = translateResponseFromGemini('responses', geminiFunctionResponse());

  if ('refusal' in response) throw new Error('Gemini response met a refusal');
  if ('outcome' in response) throw new Error('Gemini response passed through');

  return response;
}

function requestWithReasoning(encryptedContent: string): ResponsesRequest {
  return {
    model: 'alias-without-provider-name',
    input: [
      { type: 'reasoning', summary: [], content: null, encrypted_content: encryptedContent },
      { type: 'function_call', call_id: 'call_1', name: 'run', arguments: '{}' },
      { type: 'function_call_output', call_id: 'call_1', output: 'ok' },
    ],
  };
}
