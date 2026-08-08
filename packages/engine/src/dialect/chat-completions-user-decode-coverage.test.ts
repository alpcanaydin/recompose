import { describe, expect, it } from 'vitest';

import { ingressPayload } from '../gateway-wire';
import { decodeRequest } from './chat-completions-request';

describe('decodeRequest reads a user turn whose parts it does not recognise', () => {
  it('drops a part of an unknown kind and keeps the text beside it', () => {
    const request = ingressPayload('chat-completions', {
      model: 'gpt-5',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'refusal', refusal: 'I will not' },
            { type: 'text', text: 'hello' },
          ],
        },
      ],
    });

    if (request === null) throw new Error('the Chat Completions request failed validation');

    const result = decodeRequest(request);

    if ('refusal' in result) {
      throw new Error(`expected a translation, met a refusal: ${JSON.stringify(result.refusal)}`);
    }

    expect(result.value.messages[0]?.content).toEqual([{ type: 'text', text: 'hello' }]);
  });
});
