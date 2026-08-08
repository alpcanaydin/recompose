import { describe, expect, it } from 'vitest';

import type { AnthropicRequest, AnthropicToolResultBlock } from './anthropic-wire';

import { decodeRequestWithCompat } from './anthropic-request-decode';
import { translateRequestToGemini } from './gemini-bridge';
import { encodeRequest as encodeGemini } from './gemini-request';

describe('Claude request controls crossing Gemini', () => {
  it('should map a specific tool choice to ANY with one allowed function', () => {
    const value = translated({
      messages: [{ role: 'user', content: 'hi' }],
      tools: [{ name: 'json', input_schema: { type: 'object', properties: {} } }],
      tool_choice: { type: 'tool', name: 'json' },
    });

    expect(value).toHaveProperty('toolConfig.functionCallingConfig', {
      mode: 'ANY',
      allowedFunctionNames: ['json'],
    });
  });

  it('should put a string system prompt in systemInstruction', () => {
    expect(translated({ system: 'Be concise', messages: [user('Hello')] })).toHaveProperty(
      'systemInstruction.parts.0.text',
      'Be concise',
    );
  });

  it('should carry text and image content as separate Gemini parts', () => {
    const value = translated({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'describe this image' },
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: 'aGVsbG8=' },
            },
          ],
        },
      ],
    });

    expect(value.contents[0]?.parts).toEqual([
      { text: 'describe this image' },
      { inlineData: { mimeType: 'image/png', data: 'aGVsbG8=' } },
    ]);
  });
});

describe('Claude system surfaces crossing Gemini', () => {
  it('should strip only the Claude Code billing attribution block', () => {
    const value = translated({
      system: [
        { type: 'text', text: 'x-anthropic-billing-header: cc_version=2.1.63;' },
        { type: 'text', text: "You are a Claude agent, built on Anthropic's Claude Agent SDK." },
        { type: 'text', text: 'User system prompt' },
      ],
      messages: [user('hi')],
    });

    expect(value.systemInstruction?.parts.map((part) => part.text)).toEqual([
      "You are a Claude agent, built on Anthropic's Claude Agent SDK.",
      'User system prompt',
    ]);
  });

  it('should downgrade message-level system turns to user reminders without merging them', () => {
    const value = translated({
      system: 'Top-level rules',
      messages: [
        user('Hello'),
        { role: 'system', content: 'String mid-conversation rule' },
        { role: 'system', content: [{ type: 'text', text: 'Array mid-conversation rule' }] },
      ],
    });

    expect(value.contents.map((content) => content.role)).toEqual(['user', 'user', 'user']);
    expect(value.contents[1]?.parts[0]?.text).toBe(
      '<system-reminder>\nString mid-conversation rule\n</system-reminder>',
    );
    expect(value.contents[2]?.parts[0]?.text).toBe(
      '<system-reminder>\nArray mid-conversation rule\n</system-reminder>',
    );
  });

  it('should omit empty text parts', () => {
    const value = translated({
      messages: [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: '' },
            { type: 'text', text: 'hello' },
            { type: 'text', text: '' },
          ],
        },
      ],
    });

    expect(value.contents[0]?.parts).toEqual([{ text: 'hello' }]);
  });
});

describe('Claude tool results crossing Gemini', () => {
  it('should keep structured text in response.result and emit its image separately', () => {
    const value = translated(
      toolResultRequest([
        { type: 'text', text: 'alpha' },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'aGVsbG8=' } },
      ]),
    );

    expect(value.contents[1]?.parts).toEqual([
      {
        functionResponse: {
          id: 'json-call-1',
          name: 'json',
          response: { result: { text: 'alpha' } },
        },
      },
      { inlineData: { mimeType: 'image/png', data: 'aGVsbG8=' } },
    ]);
  });

  it('should keep a string tool result as an unwrapped result string', () => {
    const value = translated(toolResultRequest('alpha'));

    expect(value).toHaveProperty('contents.1.parts.0.functionResponse.response.result', 'alpha');
  });
});

describe('Claude non-object tool input crossing Gemini', () => {
  it.each([
    ['plain string', 'plain'],
    ['array', [1, 'two']],
    ['number', 42],
    ['boolean', true],
    ['null', null],
  ])('should preserve present %s input', (_label, input) => {
    const value = translated({
      messages: [
        { role: 'assistant', content: [{ type: 'tool_use', id: 'call_123', name: 'run', input }] },
      ],
    });

    expect(value).toHaveProperty('contents.0.parts.0.functionCall.args', input ?? {});
  });

  it('should omit a function call when input is missing', () => {
    const value = translated({
      messages: [
        { role: 'assistant', content: [{ type: 'tool_use', id: 'call_123', name: 'run' }] },
      ],
    });

    expect(value.contents[0]?.parts).toEqual([]);
  });
});

describe('Claude empty thinking compatibility crossing Gemini', () => {
  it('should drop it by default and preserve its empty signature in compat mode', () => {
    const request: AnthropicRequest = {
      messages: [
        {
          role: 'assistant',
          content: [{ type: 'thinking', thinking: 'reason', signature: '' }],
        },
      ],
    };
    const normal = translateRequestToGemini('anthropic', request);
    const decoded = decodeRequestWithCompat(request);

    if ('refusal' in decoded) throw new Error('expected compat request');

    expect('refusal' in normal).toBe(true);
    expect(encodeGemini(decoded.value).value.contents[0]?.parts[0]).toEqual({
      text: 'reason',
      thought: true,
      thoughtSignature: '',
    });
  });
});

function translated(request: AnthropicRequest) {
  const result = translateRequestToGemini('anthropic', request);

  if ('refusal' in result) throw new Error('expected translated request');

  return result.value;
}

function user(content: string): AnthropicRequest['messages'][number] {
  return { role: 'user', content };
}

function toolResultRequest(content: AnthropicToolResultBlock['content']): AnthropicRequest {
  return {
    messages: [
      {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'json-call-1', name: 'json', input: { ok: true } }],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'json-call-1',
            ...(content === undefined ? {} : { content }),
          },
        ],
      },
    ],
  };
}
