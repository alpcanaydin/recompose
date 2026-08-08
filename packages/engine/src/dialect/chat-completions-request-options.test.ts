import { describe, expect, it } from 'vitest';

import { translateRequest } from './dispatcher';

describe('Interactions options crossing Chat Completions', () => {
  it('should preserve expressible generation options', () => {
    const translated = translateRequest('interactions', 'chat-completions', {
      input: 'hi',
      generation_config: { thinking_level: 'high' },
      response_modalities: ['text', 'image'],
      response_format: { type: 'json_object' },
      service_tier: 'priority',
    });

    expect(translated).toHaveProperty('value.reasoning_effort', 'high');
    expect(translated).toHaveProperty('value.modalities', ['text', 'image']);
    expect(translated).toHaveProperty('value.response_format', { type: 'json_object' });
    expect(translated).toHaveProperty('value.service_tier', 'priority');
  });
});

describe('Chat Completions options crossing Interactions', () => {
  it('should restore expressible generation options', () => {
    const translated = translateRequest('chat-completions', 'interactions', {
      messages: [{ role: 'user', content: 'hi' }],
      reasoning_effort: 'medium',
      modalities: ['text'],
      response_format: { type: 'json_schema' },
      service_tier: 'priority',
      parallel_tool_calls: false,
    });

    expect(translated).toHaveProperty('value.generation_config.thinking_level', 'medium');
    expect(translated).toHaveProperty('value.response_modalities', ['text']);
    expect(translated).toHaveProperty('value.response_format', { type: 'json_schema' });
    expect(translated).toHaveProperty('value.service_tier', 'priority');
  });
});
