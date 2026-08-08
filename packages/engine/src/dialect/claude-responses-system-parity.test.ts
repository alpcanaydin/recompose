import { describe, expect, it } from 'vitest';

import { translateRequest } from './dispatcher';

describe('Responses system inputs crossing Claude', () => {
  it('should preserve instructions and system-level items as separate blocks', () => {
    const translated = translateRequest('responses', 'anthropic', {
      instructions: 'I1',
      input: [
        { type: 'message', role: 'system', content: [{ type: 'input_text', text: 'S1' }] },
        { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'U1' }] },
        { type: 'message', role: 'developer', content: 'D1' },
        { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'A1' }] },
        { type: 'message', role: 'system', content: [{ type: 'input_text', text: 'S2' }] },
      ],
    });

    expect(translated).toHaveProperty('value.system', [
      { type: 'text', text: 'I1' },
      { type: 'text', text: 'S1' },
      { type: 'text', text: 'D1' },
      { type: 'text', text: 'S2' },
    ]);
    expect(translated).toHaveProperty('value.messages', [
      { role: 'user', content: [{ type: 'text', text: 'U1' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'A1' }] },
    ]);
  });

  it('should add an empty user turn to a system-only request', () => {
    const translated = translateRequest('responses', 'anthropic', {
      instructions: 'I1',
      input: [],
    });

    expect(translated).toHaveProperty('value.system', [{ type: 'text', text: 'I1' }]);
    expect(translated).toHaveProperty('value.messages', [
      { role: 'user', content: [{ type: 'text', text: '' }] },
    ]);
  });
});

describe('Responses system markers crossing Claude', () => {
  it('should keep a non-text system part as a payload-free typed marker', () => {
    const translated = translateRequest('responses', 'anthropic', {
      input: [
        {
          type: 'message',
          role: 'developer',
          content: [
            { type: 'input_text', text: 'D1' },
            { type: 'input_image', image_url: 'data:image/png;base64,AAAA' },
          ],
        },
        { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'U1' }] },
      ],
    });

    expect(translated).toHaveProperty('value.system', [
      { type: 'text', text: 'D1' },
      { type: 'input_image' },
    ]);
  });
});

describe('Responses cache controls crossing Claude', () => {
  it('should preserve part cache and apply item cache only to the last system block', () => {
    const part = translateRequest('responses', 'anthropic', {
      input: [
        {
          type: 'message',
          role: 'user',
          content: [
            { type: 'input_text', text: 'cached', cache_control: { type: 'ephemeral' } },
            { type: 'input_text', text: 'fresh' },
          ],
        },
      ],
    });
    const system = translateRequest('responses', 'anthropic', {
      input: [
        {
          type: 'message',
          role: 'system',
          cache_control: { type: 'ephemeral' },
          content: [
            { type: 'input_text', text: 'S1' },
            { type: 'input_text', text: 'S2' },
          ],
        },
        { type: 'message', role: 'user', content: 'U1' },
      ],
    });

    expect(part).toHaveProperty('value.messages.0.content.0.cache_control', {
      type: 'ephemeral',
    });
    expect(part).not.toHaveProperty('value.messages.0.content.1.cache_control');
    expect(system).not.toHaveProperty('value.system.0.cache_control');
    expect(system).toHaveProperty('value.system.1.cache_control', { type: 'ephemeral' });
  });
});
