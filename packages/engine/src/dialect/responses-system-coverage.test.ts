import { describe, expect, it } from 'vitest';

import { responsesSystem } from './responses-system';

describe('carrying Responses cache breakpoints into the hub system prompt', () => {
  it('should carry the lifetime a text part asks its breakpoint to hold', () => {
    const system = responsesSystem({
      input: [
        {
          type: 'message',
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: 'house rules',
              cache_control: { type: 'ephemeral', ttl: '1h' },
            },
          ],
        },
      ],
    });

    expect(system).toEqual([
      { text: 'house rules', cacheBreakpoint: { type: 'ephemeral', ttl: '1h' } },
    ]);
  });

  it('should carry a breakpoint on a part that holds no text', () => {
    const system = responsesSystem({
      input: [
        {
          type: 'message',
          role: 'developer',
          content: [
            {
              type: 'input_image',
              image_url: 'https://example.com/diagram.png',
              cache_control: { type: 'ephemeral' },
            },
            { type: 'input_text', text: 'house rules' },
          ],
        },
      ],
    });

    expect(system).toEqual([
      { text: '', markerType: 'input_image', cacheBreakpoint: { type: 'ephemeral' } },
      { text: 'house rules' },
    ]);
  });
});
