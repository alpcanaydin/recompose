import { describe, expect, it } from 'vitest';

import { translateRequest } from './dispatcher';

describe('Gemini requests crossing Codex Responses', () => {
  it.each([
    ['id', { id: 'call_gateway_id' }, { id: 'call_gateway_id' }],
    ['call_id', { call_id: 'call_gateway_call_id' }, { call_id: 'call_gateway_call_id' }],
  ])('should preserve explicit %s values', (_label, callId, responseId) => {
    const value = translated({
      contents: [
        {
          role: 'model',
          parts: [{ functionCall: { name: 'lookup', args: { query: 'status' }, ...callId } }],
        },
        {
          role: 'user',
          parts: [
            { functionResponse: { name: 'lookup', response: { result: 'ok' }, ...responseId } },
          ],
        },
      ],
    });

    expect(value.input[0]).toHaveProperty('call_id', Object.values(callId)[0]);
    expect(value.input[1]).toHaveProperty('call_id', Object.values(callId)[0]);
  });
});

describe('Gemini media crossing Codex Responses', () => {
  it('should carry inline image data as input_image', () => {
    const value = translated({
      contents: [
        { role: 'user', parts: [{ inlineData: { mimeType: 'image/png', data: 'aGVsbG8=' } }] },
      ],
    });

    expect(value).toHaveProperty('input.0.content.0', {
      type: 'input_image',
      image_url: 'data:image/png;base64,aGVsbG8=',
    });
  });

  it('should split audio, video, and document data by MIME', () => {
    const value = translated({
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'audio/wav', data: 'UklGRg==' } },
            { inlineData: { mimeType: 'video/mp4', data: 'AAAAIGZ0eXA=' } },
            { inlineData: { mimeType: 'application/pdf', data: 'JVBERi0=' } },
          ],
        },
      ],
    });

    expect(value).toHaveProperty('input.0.content.0.type', 'input_audio');
    expect(value).toHaveProperty('input.0.content.1.type', 'input_file');
    expect(value).toHaveProperty('input.0.content.2.type', 'input_file');
  });
});

describe('Gemini tool schemas crossing Codex', () => {
  it('should preserve an already canonical strict schema', () => {
    const schema = {
      type: 'object',
      properties: { value: { type: 'string' } },
      additionalProperties: false,
    };

    expect(firstParameters(schema)).toEqual(schema);
  });

  it('should remove schema declarations and close additional properties', () => {
    expect(
      firstParameters({ type: 'object', $schema: 'draft', additionalProperties: true }),
    ).toEqual({
      type: 'object',
      properties: {},
      additionalProperties: false,
    });
  });
});

function translated(body: Parameters<typeof translateRequest<'gemini', 'responses'>>[2]) {
  const result = translateRequest('gemini', 'responses', body);

  if ('outcome' in result || 'refusal' in result) throw new Error('expected request');

  return result.value;
}

function firstParameters(schema: Record<string, unknown>) {
  const value = translated({
    contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
    tools: [{ functionDeclarations: [{ name: 'lookup', parameters: schema }] }],
  });
  const tool = value.tools?.[0];

  return tool?.type === 'function' ? tool.parameters : undefined;
}
