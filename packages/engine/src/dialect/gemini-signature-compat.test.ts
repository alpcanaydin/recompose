import { describe, expect, it } from 'vitest';

import type { ChatCompletionsRequest } from './chat-completions-wire';

import { translateRequestToGemini, translateResponseFromGemini } from './gemini-bridge';

const capturedSignature =
  'EjQKMgEMOdbHO0Gd+c9Mxk4ELwPGbpCEcp2mFfYYLix2UVtBH3fL8GECc4+JITVnHF4qZDsA';

describe('Gemini Chat Completions tool-call signatures', () => {
  it('should preserve a native Gemini signature', () => {
    const translated = translateRequestToGemini(
      'chat-completions',
      requestWithSignature(`gemini#${capturedSignature}`),
    );

    expect(translated).toHaveProperty(
      'value.contents.0.parts.0.thoughtSignature',
      capturedSignature,
    );
  });

  it('should replace an unknown provider signature with the Gemini bypass', () => {
    const translated = translateRequestToGemini(
      'chat-completions',
      requestWithSignature('not-a-provider-signature'),
    );

    expect(translated).toHaveProperty(
      'value.contents.0.parts.0.thoughtSignature',
      'skip_thought_signature_validator',
    );
  });

  it('should add the bypass when a function call has no signature', () => {
    const translated = translateRequestToGemini('chat-completions', requestWithSignature());

    expect(translated).toHaveProperty(
      'value.contents.0.parts.0.thoughtSignature',
      'skip_thought_signature_validator',
    );
  });
});

describe('Gemini Chat Completions signature responses', () => {
  it('should return a provider function-call signature through Chat Completions', () => {
    const translated = translateResponseFromGemini('chat-completions', {
      candidates: [
        {
          content: {
            role: 'model',
            parts: [
              {
                functionCall: { id: 'call_123', name: 'lookup', args: { q: 'Paris' } },
                thoughtSignature: capturedSignature,
              },
            ],
          },
          finishReason: 'STOP',
        },
      ],
    });

    expect(translated).toHaveProperty(
      'value.choices.0.message.tool_calls.0.extra_content.google.thought_signature',
      `gemini#${capturedSignature}`,
    );
  });
});

// Helpers

function requestWithSignature(signature?: string): ChatCompletionsRequest {
  return {
    messages: [
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_123',
            type: 'function',
            function: { name: 'lookup', arguments: '{"q":"Paris"}' },
            ...(signature === undefined
              ? {}
              : { extra_content: { google: { thought_signature: signature } } }),
          },
        ],
      },
      { role: 'tool', tool_call_id: 'call_123', content: 'sunny' },
    ],
  };
}
