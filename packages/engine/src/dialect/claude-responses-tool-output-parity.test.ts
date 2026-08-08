import { describe, expect, it } from 'vitest';

import { translateRequest } from './dispatcher';

describe('Responses function output media crossing Claude', () => {
  it('should preserve text and a base64 image inside one tool result', () => {
    const translated = translateRequest('responses', 'anthropic', {
      input: [
        { type: 'function_call', call_id: 'call_1', name: 'lookup', arguments: '{}' },
        {
          type: 'function_call_output',
          call_id: 'call_1',
          output: [
            { type: 'input_text', text: 'result' },
            { type: 'input_image', image_url: 'data:image/png;base64,aGVsbG8=' },
          ],
        },
      ],
    });

    expect(translated).toHaveProperty('value.messages.1.content.0', {
      type: 'tool_result',
      tool_use_id: 'call_1',
      content: [
        { type: 'text', text: 'result' },
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/png', data: 'aGVsbG8=' },
        },
      ],
    });
  });

  it('should preserve a URL image without fabricating text', () => {
    const translated = translateRequest('responses', 'anthropic', {
      input: [
        { type: 'function_call', call_id: 'call_1', name: 'lookup', arguments: '{}' },
        {
          type: 'function_call_output',
          call_id: 'call_1',
          output: [{ type: 'input_image', image_url: 'https://example.test/result.png' }],
        },
      ],
    });

    expect(translated).toHaveProperty('value.messages.1.content.0.content', [
      {
        type: 'image',
        source: { type: 'url', url: 'https://example.test/result.png' },
      },
    ]);
  });
});
