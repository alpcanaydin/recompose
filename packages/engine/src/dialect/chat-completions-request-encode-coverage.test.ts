import { describe, expect, it } from 'vitest';

import { encodeRequest } from './chat-completions-request';
import { aHubMessage, aHubRequest } from './hub.testkit';

describe('encodeRequest: audio a Chat Completions client cannot fetch', () => {
  it('drops a hosted audio block rather than sending a url the shape cannot hold', () => {
    const request = aHubRequest({
      messages: [
        aHubMessage({
          role: 'user',
          content: [
            { type: 'text', text: 'Transcribe this.' },
            { type: 'audio', source: { type: 'url', url: 'https://example.test/clip.mp3' } },
          ],
        }),
      ],
    });

    const { value } = encodeRequest(request);

    expect(JSON.stringify(value)).not.toContain('clip.mp3');
    expect(value.messages[0]?.content).toBe('Transcribe this.');
  });
});
