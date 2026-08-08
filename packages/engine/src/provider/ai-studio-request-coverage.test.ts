import { describe, expect, it } from 'vitest';

import { reachAIStudio } from './ai-studio-request';

describe('reaching AI Studio through a relay channel', () => {
  it('should reach nobody when the request names no channel', async () => {
    const relayed = await reachAIStudio(undefined, {
      url: 'https://aistudio.google.com/v1/models',
      method: 'POST',
      headers: {},
      body: '{}',
    });

    expect(relayed).toBeNull();
  });

  it('should reach nobody when no relay is running', async () => {
    const relayed = await reachAIStudio('channel-1', {
      url: 'https://aistudio.google.com/v1/models',
      method: 'POST',
      headers: {},
      body: '{}',
    });

    expect(relayed).toBeNull();
  });
});
