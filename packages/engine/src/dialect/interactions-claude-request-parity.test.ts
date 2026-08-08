import { describe, expect, it } from 'vitest';

import { translateRequest } from './dispatcher';

describe('Claude requests crossing Interactions', () => {
  it('should map messages, tools, and output-token sampling', () => {
    const translated = translateRequest('anthropic', 'interactions', {
      model: 'claude-test',
      max_tokens: 1024,
      tools: [
        {
          name: 'get_weather',
          description: 'Weather',
          input_schema: {
            type: 'object',
            properties: { location: { type: 'string' } },
            required: ['location'],
          },
        },
      ],
      messages: [{ role: 'user', content: [{ type: 'text', text: 'weather?' }] }],
    });

    expect(translated).toHaveProperty('value.input.0.type', 'user_input');
    expect(translated).toHaveProperty('value.tools.0.name', 'get_weather');
    expect(translated).toHaveProperty(
      'value.tools.0.parameters.properties.location.type',
      'string',
    );
    expect(translated).toHaveProperty('value.generation_config.max_output_tokens', 1024);
  });
});

describe('Claude tool history crossing Interactions', () => {
  it('should map paired tool use and result history', () => {
    const translated = translateRequest('anthropic', 'interactions', {
      max_tokens: 64,
      messages: [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_1',
              name: 'get_weather',
              input: { location: '北京' },
            },
          ],
        },
        {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: '晴' }],
        },
      ],
    });

    expect(translated).toHaveProperty('value.input.0.call_id', 'toolu_1');
    expect(translated).toHaveProperty('value.input.1', {
      type: 'function_result',
      call_id: 'toolu_1',
      result: '晴',
    });
  });
});

describe('Interactions turn grouping crossing Claude', () => {
  it('should group consecutive equal roles without crossing role changes', () => {
    const translated = translateRequest('interactions', 'anthropic', {
      input: [
        { type: 'user_input', content: 'one' },
        { type: 'user_input', content: 'two' },
        { type: 'model_output', content: 'three' },
        { type: 'model_output', content: 'four' },
        { type: 'user_input', content: 'five' },
      ],
    });

    expect(translated).toHaveProperty('value.messages', [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'one' },
          { type: 'text', text: 'two' },
        ],
      },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'three' },
          { type: 'text', text: 'four' },
        ],
      },
      { role: 'user', content: [{ type: 'text', text: 'five' }] },
    ]);
  });
});

describe('Interactions media crossing Claude', () => {
  it('should preserve image content as an Anthropic image', () => {
    const translated = translateRequest('interactions', 'anthropic', {
      input: [
        {
          type: 'user_input',
          content: [{ type: 'image', mime_type: 'image/png', data: 'aGVsbG8=' }],
        },
      ],
    });

    expect(translated).toHaveProperty('value.messages.0.content.0', {
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: 'aGVsbG8=' },
    });
  });

  it('should preserve non-image media without pretending it is an image', () => {
    const translated = translateRequest('interactions', 'anthropic', {
      input: [
        {
          type: 'user_input',
          content: [
            { type: 'audio', mime_type: 'audio/wav', data: 'UklGRg==' },
            { type: 'video', mime_type: 'video/mp4', data: 'AAAAIGZ0eXA=' },
            { type: 'document', mime_type: 'application/pdf', data: 'JVBERi0=' },
          ],
        },
      ],
    });
    const messages = JSON.stringify(translated);

    expect(messages).not.toContain('"type":"image"');
    expect(messages).toContain('audio/wav');
    expect(messages).toContain('video/mp4');
    expect(messages).toContain('application/pdf');
  });
});
