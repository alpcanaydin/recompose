import { describe, expect, it } from 'vitest';

import { translateRequest } from './dispatcher';
import { translateRequestToGemini } from './gemini-bridge';

describe('Interactions image content', () => {
  it('should become a Chat Completions image URL', () => {
    const translated = translateRequest('interactions', 'chat-completions', {
      input: [
        {
          type: 'user_input',
          content: [{ type: 'image', mime_type: 'image/png', data: 'aGVsbG8=' }],
        },
      ],
    });

    expect(translated).toHaveProperty(
      'value.messages.0.content.0.image_url.url',
      'data:image/png;base64,aGVsbG8=',
    );
  });
});

describe('Interactions nested file data', () => {
  it('should normalize an OpenAI file data URL into Gemini inline data', () => {
    const translated = translateRequestToGemini('interactions', {
      model: 'gemini-3.5-flash',
      input: [
        {
          type: 'user_input',
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

    expect(translated).toHaveProperty('value.contents.0.parts.0.inlineData', {
      mimeType: 'application/pdf',
      data: 'JVBERi0xLjQK',
    });
  });

  it('should retain document bytes and filename through Responses', () => {
    const translated = translateRequest('interactions', 'responses', {
      input: [
        {
          type: 'user_input',
          content: [
            {
              type: 'document',
              mime_type: 'application/pdf',
              data: 'JVBERi0=',
              name: 'brief.pdf',
            },
          ],
        },
      ],
    });

    expect(translated).toHaveProperty('value.input.0.content.0', {
      type: 'input_file',
      file_data: 'data:application/pdf;base64,JVBERi0=',
      filename: 'brief.pdf',
    });
  });
});

describe('Interactions function-call identity crossing Gemini', () => {
  it('should preserve call ids on calls and results', () => {
    const translated = translateRequestToGemini('interactions', {
      input: [
        { type: 'function_call', call_id: 'call_1', name: 'lookup', arguments: { q: 'x' } },
        { type: 'function_result', call_id: 'call_1', name: 'lookup', result: { ok: true } },
      ],
    });

    expect(translated).toHaveProperty('value.contents.0.parts.0.functionCall.id', 'call_1');
    expect(translated).toHaveProperty('value.contents.1.parts.0.functionResponse.id', 'call_1');
  });
});
