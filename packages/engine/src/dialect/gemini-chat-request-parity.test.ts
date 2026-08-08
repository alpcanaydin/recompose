import { describe, expect, it } from 'vitest';

import type { ChatCompletionsRequest } from './chat-completions-wire';

import { translateRequestToGemini } from './gemini-bridge';

describe('Chat conversation normalization crossing Gemini', () => {
  it('should strip a trailing assistant prefill', () => {
    const value = translated({
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'previous answer' },
      ],
    });

    expect(value.contents).toEqual([{ role: 'user', parts: [{ text: 'hello' }] }]);
  });

  it('should skip empty text parts without nulls or empty messages', () => {
    const value = translated({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: '' },
            { type: 'input_audio', input_audio: { data: 'SUQzBA==', format: 'mp3' } },
          ],
        },
        {
          role: 'assistant',
          content: '',
          tool_calls: [
            { id: 'call_1', type: 'function', function: { name: 'read_file', arguments: '{}' } },
          ],
        },
        { role: 'tool', tool_call_id: 'call_1', content: 'ok' },
        { role: 'assistant', content: '' },
        { role: 'user', content: 'done' },
      ],
    });

    expect(value.contents[0]?.parts).toEqual([
      { inlineData: { mimeType: 'audio/mpeg', data: 'SUQzBA==' } },
    ]);
    expect(value.contents[1]?.parts).toHaveLength(1);
    expect(JSON.stringify(value)).not.toContain('null');
  });
});

describe('Chat media crossing Gemini', () => {
  it('should preserve input audio and video data', () => {
    const value = translated({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'input_audio', input_audio: { data: 'SUQzBA==', format: 'mp3' } },
            { type: 'video_url', video_url: { url: 'data:video/mp4;base64,AAAAIGZ0eXA=' } },
          ],
        },
      ],
    });

    expect(value.contents[0]?.parts).toEqual([
      { inlineData: { mimeType: 'audio/mpeg', data: 'SUQzBA==' } },
      { inlineData: { mimeType: 'video/mp4', data: 'AAAAIGZ0eXA=' } },
    ]);
  });

  it('should normalize a file data URL into inline data', () => {
    const value = translated({
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              file: {
                filename: 'test.pdf',
                file_data: 'data:application/pdf;base64,JVBERi0xLjQK',
              },
            },
          ],
        },
      ],
    });

    expect(value.contents[0]?.parts[0]).toEqual({
      inlineData: { mimeType: 'application/pdf', data: 'JVBERi0xLjQK' },
    });
  });
});

describe('Chat reasoning crossing Gemini', () => {
  it('should preserve reasoning before visible content and a tool call', () => {
    const value = translated({
      messages: [
        { role: 'user', content: 'hi' },
        {
          role: 'assistant',
          reasoning_content: 'thinking',
          content: 'visible',
          tool_calls: [
            { id: 'call_1', type: 'function', function: { name: 'lookup', arguments: '{}' } },
          ],
        },
        { role: 'tool', tool_call_id: 'call_1', content: 'ok' },
      ],
    });

    expect(value.contents[1]?.parts.map(partKind)).toEqual(['thought', 'text', 'functionCall']);
  });

  it('should preserve Gemini signatures and replace foreign signatures with bypass', () => {
    const native = 'EjQKMgEMOdbHO0Gd+c9Mxk4ELwPGbpCEcp2mFfYYLix2UVtBH3fL8GECc4+JITVnHF4qZDsA';

    expect(toolSignature(`gemini#${native}`)).toBe(native);
    expect(toolSignature('not-a-provider-signature')).toBe('skip_thought_signature_validator');
  });
});

describe('Chat generation controls crossing Gemini', () => {
  it('should map max_tokens to maxOutputTokens', () => {
    expect(
      translated({ messages: [{ role: 'user', content: 'hi' }], max_tokens: 321 }),
    ).toHaveProperty('generationConfig.maxOutputTokens', 321);
  });

  it.each([
    [{ type: 'json_object' }, { responseMimeType: 'application/json' }],
    [
      { type: 'json_schema', json_schema: { name: 'answer', schema: { type: 'object' } } },
      { responseMimeType: 'application/json', responseJsonSchema: { type: 'object' } },
    ],
    [
      { type: 'json_schema', json_schema: { name: 'answer' } },
      { responseMimeType: 'application/json' },
    ],
    [{ type: 'text' }, {}],
  ])('should map response format %j', (responseFormat, expected) => {
    expect(
      translated({
        messages: [{ role: 'user', content: 'hi' }],
        response_format: responseFormat,
      }).generationConfig,
    ).toMatchObject(expected);
  });
});

describe('Chat tool schemas crossing Gemini', () => {
  it('should stringify tool names, remove strict, and clean required fields', () => {
    const declaration = malformedToolDeclaration();

    expect(declaration?.name).toBe('true');
    expect(declaration?.parameters).not.toHaveProperty('title');
    expect(declaration?.parameters['required']).toEqual(['country', 'industry']);
  });
});

function malformedToolDeclaration() {
  const value = translated({
    messages: [{ role: 'user', content: 'hi' }],
    tools: [
      {
        type: 'function',
        function: {
          name: true,
          parameters: {
            type: 'object',
            title: 'remove me',
            properties: { country: { type: 'string' }, industry: { type: 'string' } },
            required: ['country', 'missing', 'industry'],
          },
        },
      },
    ],
  });

  return value.tools?.[0]?.functionDeclarations[0];
}

function translated(request: ChatCompletionsRequest) {
  const result = translateRequestToGemini('chat-completions', request);

  if ('refusal' in result) throw new Error('expected Gemini request');

  return result.value;
}

function partKind(part: { text?: string; thought?: boolean; functionCall?: unknown }): string {
  if (part.functionCall !== undefined) return 'functionCall';
  if (part.thought === true) return 'thought';

  return 'text';
}

function toolSignature(signature: string): string | undefined {
  const value = translated({
    messages: [
      {
        role: 'assistant',
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'lookup',
              arguments: '{}',
              extra_content: { google: { thought_signature: signature } },
            },
          },
        ],
      },
      { role: 'tool', tool_call_id: 'call_1', content: 'ok' },
    ],
  });

  return value.contents[0]?.parts[0]?.thoughtSignature;
}
