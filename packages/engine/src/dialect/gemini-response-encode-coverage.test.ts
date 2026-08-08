import { describe, expect, it } from 'vitest';

import type { HubContentBlock, HubResponse, HubStopReason, HubUsage } from './hub';

import { encodeResponse, geminiUsageFromHub } from './gemini-response-encode';

function responseOf(content: readonly HubContentBlock[]): HubResponse {
  return { content, stopReason: 'end', usage: {} };
}

function stoppedBy(stopReason: HubStopReason): HubResponse {
  return { content: [], stopReason, usage: {} };
}

function usageOf(usage: HubUsage): HubResponse {
  return { content: [], stopReason: 'end', usage };
}

describe('Encoding hub content into Gemini parts', () => {
  it('should render a text block as a plain text part', () => {
    const encoded = encodeResponse(responseOf([{ type: 'text', text: 'hello' }]));

    expect(encoded).toHaveProperty('value.candidates.0.content.parts', [{ text: 'hello' }]);
  });

  it('should mark a thinking block as thought and carry its signature', () => {
    const encoded = encodeResponse(
      responseOf([{ type: 'thinking', text: 'weighing', signature: 'sig-1' }]),
    );

    expect(encoded).toHaveProperty('value.candidates.0.content.parts', [
      { text: 'weighing', thought: true, thoughtSignature: 'sig-1' },
    ]);
  });

  it('should leave an unsigned thinking block without a thought signature', () => {
    const encoded = encodeResponse(responseOf([{ type: 'thinking', text: 'weighing' }]));

    expect(encoded).toHaveProperty('value.candidates.0.content.parts', [
      { text: 'weighing', thought: true },
    ]);
  });
});

describe('Encoding hub tool calls into Gemini function calls', () => {
  it('should render a tool call as a function call carrying its signature', () => {
    const encoded = encodeResponse(
      responseOf([
        {
          type: 'tool_use',
          id: 'call_1',
          name: 'lookup',
          input: { city: 'Ankara' },
          signature: 's',
        },
      ]),
    );

    expect(encoded).toHaveProperty('value.candidates.0.content.parts', [
      {
        functionCall: { id: 'call_1', name: 'lookup', args: { city: 'Ankara' } },
        thoughtSignature: 's',
      },
    ]);
  });

  it('should render a tool call without arguments as an empty argument object', () => {
    const encoded = encodeResponse(
      responseOf([{ type: 'tool_use', id: 'call_1', name: 'ping', input: undefined }]),
    );

    expect(encoded).toHaveProperty('value.candidates.0.content.parts', [
      { functionCall: { id: 'call_1', name: 'ping', args: {} } },
    ]);
  });

  it('should drop a block Gemini has no part for', () => {
    const encoded = encodeResponse(responseOf([{ type: 'redacted_thinking', data: 'opaque' }]));

    expect(encoded).toHaveProperty('value.candidates.0.content.parts', []);
  });

  it('should render an image block as a Gemini media part', () => {
    const encoded = encodeResponse(
      responseOf([
        { type: 'image', source: { type: 'base64', mediaType: 'image/png', data: 'aGk=' } },
      ]),
    );

    expect(encoded).toHaveProperty(
      'value.candidates.0.content.parts.0.inlineData.mimeType',
      'image/png',
    );
  });
});

describe('Encoding hub tool results into Gemini function responses', () => {
  it('should name the function response after the tool when the result names it', () => {
    const encoded = encodeResponse(
      responseOf([
        {
          type: 'tool_result',
          toolUseId: 'call_1',
          name: 'lookup',
          content: [],
          structuredResult: { temperature: 21 },
        },
      ]),
    );

    expect(encoded).toHaveProperty('value.candidates.0.content.parts', [
      { functionResponse: { id: 'call_1', name: 'lookup', response: { temperature: 21 } } },
    ]);
  });

  it('should fall back to the tool call id when the result names no tool', () => {
    const encoded = encodeResponse(
      responseOf([
        {
          type: 'tool_result',
          toolUseId: 'call_1',
          content: [{ type: 'text', text: 'sunny' }],
        },
      ]),
    );

    expect(encoded).toHaveProperty('value.candidates.0.content.parts', [
      {
        functionResponse: {
          id: 'call_1',
          name: 'call_1',
          response: { output: [{ type: 'text', text: 'sunny' }] },
        },
      },
    ]);
  });
});

describe('Shaping a hub tool result for a Gemini function response', () => {
  it('should wrap a scalar structured result under an output field', () => {
    const encoded = encodeResponse(
      responseOf([
        { type: 'tool_result', toolUseId: 'call_1', content: [], structuredResult: 'sunny' },
      ]),
    );

    expect(encoded).toHaveProperty('value.candidates.0.content.parts.0.functionResponse.response', {
      output: 'sunny',
    });
  });

  it('should wrap a list structured result under an output field', () => {
    const encoded = encodeResponse(
      responseOf([
        { type: 'tool_result', toolUseId: 'call_1', content: [], structuredResult: [1, 2] },
      ]),
    );

    expect(encoded).toHaveProperty('value.candidates.0.content.parts.0.functionResponse.response', {
      output: [1, 2],
    });
  });

  it('should wrap an absent structured result under an output field', () => {
    const encoded = encodeResponse(
      responseOf([
        { type: 'tool_result', toolUseId: 'call_1', content: [], structuredResult: null },
      ]),
    );

    expect(encoded).toHaveProperty('value.candidates.0.content.parts.0.functionResponse.response', {
      output: null,
    });
  });
});

describe('Encoding the hub stop reason for Gemini', () => {
  it('should report a truncated answer as a token ceiling', () => {
    expect(encodeResponse(stoppedBy('max_output'))).toHaveProperty(
      'value.candidates.0.finishReason',
      'MAX_TOKENS',
    );
  });

  it('should report an overflowed context as a token ceiling', () => {
    expect(encodeResponse(stoppedBy('context_overflow'))).toHaveProperty(
      'value.candidates.0.finishReason',
      'MAX_TOKENS',
    );
  });

  it('should report a refusal as a safety stop', () => {
    expect(encodeResponse(stoppedBy('refusal'))).toHaveProperty(
      'value.candidates.0.finishReason',
      'SAFETY',
    );
  });

  it('should report a completed answer as a plain stop', () => {
    expect(encodeResponse(stoppedBy('tool_use'))).toHaveProperty(
      'value.candidates.0.finishReason',
      'STOP',
    );
  });
});

describe('Encoding the response identity for Gemini', () => {
  it('should carry the response id and model when the hub response names them', () => {
    const encoded = encodeResponse({
      id: 'resp_1',
      model: 'gemini-3-pro',
      content: [],
      stopReason: 'end',
      usage: {},
    });

    expect(encoded).toHaveProperty('value.responseId', 'resp_1');
    expect(encoded).toHaveProperty('value.modelVersion', 'gemini-3-pro');
  });

  it('should omit the response id and model when the hub response names neither', () => {
    const encoded = encodeResponse(usageOf({}));

    expect(encoded.value).not.toHaveProperty('responseId');
    expect(encoded.value).not.toHaveProperty('modelVersion');
  });
});

describe('Encoding hub usage for Gemini', () => {
  it('should report nothing when the hub counted nothing', () => {
    expect(geminiUsageFromHub({})).toEqual({});
  });

  it('should prefer the total input count the hub already resolved', () => {
    const usage = geminiUsageFromHub({
      totalInputTokens: 100,
      inputTokens: 10,
      cacheReadTokens: 5,
    });

    expect(usage).toEqual({
      promptTokenCount: 100,
      cachedContentTokenCount: 5,
      totalTokenCount: 100,
    });
  });

  it('should add the cache counts into the prompt count when no total was resolved', () => {
    const usage = geminiUsageFromHub({
      inputTokens: 10,
      cacheReadTokens: 5,
      cacheWriteTokens: 2,
      outputTokens: 20,
      reasoningTokens: 3,
    });

    expect(usage).toEqual({
      promptTokenCount: 17,
      candidatesTokenCount: 20,
      cachedContentTokenCount: 5,
      thoughtsTokenCount: 3,
      totalTokenCount: 40,
    });
  });

  it('should report only the answer count when the hub counted no input', () => {
    expect(geminiUsageFromHub({ outputTokens: 20 })).toEqual({
      candidatesTokenCount: 20,
      totalTokenCount: 20,
    });
  });
});
