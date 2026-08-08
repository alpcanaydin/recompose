import { describe, expect, it } from 'vitest';

import type { HubContentBlock, HubRequest } from './hub';

import { encodeRequest } from './interactions-codec';

describe('Interactions tool results', () => {
  it('should carry a tool result image beside its text', () => {
    const encoded = encodeRequest(
      requestSaying({
        type: 'tool_result',
        toolUseId: 'call_1',
        name: 'screenshot',
        content: [
          { type: 'text', text: 'here' },
          { type: 'image', source: { type: 'url', url: 'https://example.test/a.png' } },
        ],
      }),
    );

    expect(encoded.value.input).toEqual([
      {
        type: 'function_result',
        call_id: 'call_1',
        name: 'screenshot',
        result: [
          { type: 'text', text: 'here' },
          { type: 'image', uri: 'https://example.test/a.png' },
        ],
      },
    ]);
  });

  it('should flatten a tool result that says one thing in words', () => {
    const encoded = encodeRequest(
      requestSaying({
        type: 'tool_result',
        toolUseId: 'call_1',
        content: [{ type: 'text', text: 'done' }],
      }),
    );

    expect(encoded.value.input).toEqual([
      { type: 'function_result', call_id: 'call_1', result: 'done' },
    ]);
  });
});

describe('Interactions structured tool results', () => {
  it('should send a structured tool result exactly as the caller shaped it', () => {
    const encoded = encodeRequest(
      requestSaying({
        type: 'tool_result',
        toolUseId: 'call_1',
        content: [{ type: 'text', text: 'ignored' }],
        structuredResult: { rows: 3 },
      }),
    );

    expect(encoded.value.input).toEqual([
      { type: 'function_result', call_id: 'call_1', result: { rows: 3 } },
    ]);
  });
});

describe('Interactions reasoning steps', () => {
  it('should send an unsigned thought without a signature', () => {
    const encoded = encodeRequest(requestSaying({ type: 'thinking', text: 'weighing it' }));

    expect(encoded.value.input).toEqual([
      { type: 'thought', content: [{ type: 'text', text: 'weighing it' }] },
    ]);
  });

  it('should send a redacted thought as its signature alone', () => {
    const encoded = encodeRequest(requestSaying({ type: 'redacted_thinking', data: 'opaque' }));

    expect(encoded.value.input).toEqual([{ type: 'thought', content: [], signature: 'opaque' }]);
  });

  it('should drop media the Interactions dialect cannot carry', () => {
    const encoded = encodeRequest(
      requestSaying({ type: 'audio', source: { type: 'url', url: 'https://example.test/a.mp3' } }),
    );

    expect(encoded.value.input).toEqual([]);
  });
});

describe('Interactions turn roles', () => {
  it('should mark what the caller says as input and what the model says as output', () => {
    const encoded = encodeRequest({
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'question' }] },
        { role: 'assistant', content: [{ type: 'text', text: 'answer' }] },
      ],
    });

    expect(encoded.value.input).toEqual([
      { type: 'user_input', content: [{ type: 'text', text: 'question' }] },
      { type: 'model_output', content: [{ type: 'text', text: 'answer' }] },
    ]);
  });
});

describe('Interactions request options', () => {
  it('should send a tool that carries no description without one', () => {
    const encoded = encodeRequest({
      ...requestSaying({ type: 'text', text: 'hello' }),
      tools: [{ name: 'read_file', inputSchema: { type: 'object', properties: {} } }],
    });

    expect(encoded.value.tools).toEqual([
      {
        type: 'function',
        name: 'read_file',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
    ]);
  });
});

describe('Interactions tool choices', () => {
  it('should leave a web search tool choice out of the generation config', () => {
    const encoded = encodeRequest({
      ...requestSaying({ type: 'text', text: 'hello' }),
      toolChoice: { type: 'web_search' },
    });

    expect(encoded.value).not.toHaveProperty('generation_config');
  });

  it('should name the tool a caller insists on', () => {
    const encoded = encodeRequest({
      ...requestSaying({ type: 'text', text: 'hello' }),
      toolChoice: { type: 'tool', name: 'read_file' },
    });

    expect(encoded.value.generation_config).toEqual({
      tool_choice: { type: 'function', name: 'read_file' },
    });
  });

  it('should leave an empty system instruction out of the request', () => {
    const encoded = encodeRequest({
      ...requestSaying({ type: 'text', text: 'hello' }),
      system: [{ text: '' }],
    });

    expect(encoded.value).not.toHaveProperty('system_instruction');
  });

  it('should send the system instruction a caller states', () => {
    const encoded = encodeRequest({
      ...requestSaying({ type: 'text', text: 'hello' }),
      system: [{ text: 'Be concise' }],
    });

    expect(encoded.value.system_instruction).toBe('Be concise');
  });
});

function requestSaying(block: HubContentBlock): HubRequest {
  return { messages: [{ role: 'user', content: [block] }] };
}
