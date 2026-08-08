import { describe, expect, test } from 'vitest';

import { createGatewayApp } from './gateway-app';
import {
  aCredentialedGrant,
  aGatewayHolding,
  aVirtualModel,
  bodySentIn,
  fetchAnsweringWith,
} from './gateway-app.testkit';

type Crossed = { answer: Response; sent: ReturnType<typeof fetchAnsweringWith>['sent'] };

async function crossed(messages: readonly unknown[]): Promise<Crossed> {
  const { sent, fetchLike } = fetchAnsweringWith(() => Response.json({ choices: [] }));
  const app = createGatewayApp(
    aGatewayHolding(aVirtualModel()),
    async () => Promise.resolve(aCredentialedGrant()),
    fetchLike,
  );

  const answer = await app.request('http://127.0.0.1:8397/v1/messages', {
    method: 'POST',
    body: JSON.stringify({ model: 'fast', max_tokens: 1024, messages }),
  });

  return { answer, sent };
}

describe('every tool_result answer form the wire allows passes the guard', () => {
  test('string content, absent content, and all five part kinds cross', async () => {
    const { sent } = await crossed([
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'toolu_1', content: 'plain answer' },
          { type: 'tool_result', tool_use_id: 'toolu_2' },
          {
            type: 'tool_result',
            tool_use_id: 'toolu_3',
            content: [
              { type: 'text', text: 'sunny' },
              { type: 'image', source: { type: 'url', url: 'https://images.example/map.png' } },
              {
                type: 'search_result',
                title: 'Weather',
                source: 'https://weather.example',
                content: [],
              },
              {
                type: 'document',
                source: { type: 'base64', media_type: 'application/pdf', data: 'JVBERi0=' },
              },
              { type: 'tool_reference', tool_name: 'get_weather' },
            ],
          },
        ],
      },
    ]);

    expect(bodySentIn(sent)['model']).toBe('gpt-5-mini');
  });
});

describe('a tool_result part the hub cannot carry never breaks the crossing', () => {
  test('a tool_result carrying a tool_reference part serves rather than erroring', async () => {
    const { sent } = await crossed([
      { role: 'user', content: 'What is the weather?' },
      {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'toolu_1', name: 'get_weather', input: {} }],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_1',
            content: [
              { type: 'tool_reference', tool_name: 'get_weather' },
              { type: 'text', text: 'sunny' },
            ],
          },
        ],
      },
    ]);

    expect(bodySentIn(sent)['model']).toBe('gpt-5-mini');
  });
});

describe('a tool_result the guard cannot read refuses typed', () => {
  test.each([
    [[{ type: 'mystery' }]],
    [[{ type: 42 }]],
    [[{ type: 'text', text: 'x' }, { type: 'mystery' }]],
    [42],
  ])('refuses the tool_result content %j with the typed 400', async (content) => {
    const { answer, sent } = await crossed([
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content }] },
    ]);

    expect(answer.status).toBe(400);
    expect(sent).toEqual([]);
  });
});
