import { describe, expect, it } from 'vitest';

import { decodeRequest } from './anthropic-request';
import { anAnthropicAsk, decodedValue } from './anthropic.testkit';

describe('the tool blocks cross under their wire names', () => {
  it('reads tool_use and a tool_result answering under its wire id', () => {
    const { value } = decodedValue(
      anAnthropicAsk({
        messages: [
          { role: 'user', content: 'What is the weather in Paris?' },
          {
            role: 'assistant',
            content: [
              { type: 'tool_use', id: 'toolu_01', name: 'get_weather', input: { city: 'Paris' } },
            ],
          },
          {
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: 'toolu_01', content: 'sunny, 21C' }],
          },
        ],
      }),
    );

    expect(value.messages.at(1)?.content).toEqual([
      { type: 'tool_use', id: 'toolu_01', name: 'get_weather', input: { city: 'Paris' } },
    ]);
    expect(value.messages.at(2)?.content).toEqual([
      {
        type: 'tool_result',
        toolUseId: 'toolu_01',
        content: [{ type: 'text', text: 'sunny, 21C' }],
      },
    ]);
  });
});

describe('an erroring tool_result keeps its mark', () => {
  it('keeps an erroring tool_result marked as an error', () => {
    const { value } = decodedValue(
      anAnthropicAsk({
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'toolu_01',
                content: [{ type: 'text', text: 'no such city' }],
                is_error: true,
              },
            ],
          },
        ],
      }),
    );

    expect(value.messages.at(0)?.content.at(0)).toMatchObject({ isError: true });
  });
});

describe('a tool_result carries whatever answer form the wire allows', () => {
  it('reads an image part inside a tool_result as a hub image', () => {
    const { value } = decodedValue(
      anAnthropicAsk({
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'toolu_01',
                content: [
                  { type: 'image', source: { type: 'url', url: 'https://images.example/map.png' } },
                ],
              },
            ],
          },
        ],
      }),
    );

    expect(value.messages.at(0)?.content).toStrictEqual([
      {
        type: 'tool_result',
        toolUseId: 'toolu_01',
        content: [
          { type: 'image', source: { type: 'url', url: 'https://images.example/map.png' } },
        ],
      },
    ]);
  });

  it('reads a tool_result carrying no content as an empty answer', () => {
    const { value } = decodedValue(
      anAnthropicAsk({
        messages: [{ role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_01' }] }],
      }),
    );

    expect(value.messages.at(0)?.content).toStrictEqual([
      { type: 'tool_result', toolUseId: 'toolu_01', content: [] },
    ]);
  });
});

describe('an unsigned thinking block crosses without an invented signature', () => {
  it('reads a thinking block without a signature, inventing none', () => {
    const { value } = decodedValue(
      anAnthropicAsk({
        messages: [{ role: 'assistant', content: [{ type: 'thinking', thinking: 'quietly' }] }],
      }),
    );

    expect(value.messages.at(0)?.content).toStrictEqual([{ type: 'thinking', text: 'quietly' }]);
  });
});

describe('the thinking and image blocks cross whole', () => {
  it('reads thinking and redacted_thinking blocks whole', () => {
    const { value } = decodedValue(
      anAnthropicAsk({
        messages: [
          {
            role: 'assistant',
            content: [
              { type: 'thinking', thinking: 'weigh the routes', signature: 'sig-40d1' },
              { type: 'redacted_thinking', data: 'opaque-payload' },
            ],
          },
        ],
      }),
    );

    expect(value.messages.at(0)?.content).toEqual([
      { type: 'thinking', text: 'weigh the routes', signature: 'sig-40d1' },
      { type: 'redacted_thinking', data: 'opaque-payload' },
    ]);
  });

  it('reads base64 and url image sources into the hub forms', () => {
    const { value } = decodedValue(
      anAnthropicAsk({
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/png', data: 'aGVsbG8=' },
              },
              { type: 'image', source: { type: 'url', url: 'https://images.example/sky.png' } },
            ],
          },
        ],
      }),
    );

    expect(value.messages.at(0)?.content).toEqual([
      { type: 'image', source: { type: 'base64', mediaType: 'image/png', data: 'aGVsbG8=' } },
      { type: 'image', source: { type: 'url', url: 'https://images.example/sky.png' } },
    ]);
  });
});

describe('the breakpoints and turn order the wire allows', () => {
  it('carries a cache_control breakpoint on a message text block', () => {
    const { value } = decodedValue(
      anAnthropicAsk({
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'hello', cache_control: { type: 'ephemeral' } }],
          },
        ],
      }),
    );

    expect(value.messages.at(0)?.content).toEqual([
      { type: 'text', text: 'hello', cacheBreakpoint: { type: 'ephemeral' } },
    ]);
  });

  it('merges adjacent same-role turns the way the wire allows', () => {
    const { value } = decodedValue(
      anAnthropicAsk({
        messages: [
          { role: 'user', content: 'first' },
          { role: 'user', content: 'second' },
        ],
      }),
    );

    expect(value.messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'first' },
          { type: 'text', text: 'second' },
        ],
      },
    ]);
  });
});

describe('an empty text folds away without vanishing untraced', () => {
  it('drops an empty text block, keeps its neighbors, and records the fate', () => {
    const { value, fates } = decodedValue(
      anAnthropicAsk({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: '' },
              { type: 'text', text: 'kept' },
            ],
          },
        ],
      }),
    );

    expect(value.messages.at(0)?.content).toStrictEqual([{ type: 'text', text: 'kept' }]);
    expect(fates).toContainEqual({ field: 'content', disposition: 'mapped', to: 'absent' });
  });
});

describe('decodeRequest refuses what it cannot translate', () => {
  it('refuses an empty conversation', () => {
    const result = decodeRequest(anAnthropicAsk({ messages: [] }));

    expect(result).toEqual({ refusal: { reason: 'empty-conversation' } });
  });

  it('refuses a conversation whose every text folds away empty', () => {
    const result = decodeRequest(anAnthropicAsk({ messages: [{ role: 'user', content: '' }] }));

    expect(result).toEqual({ refusal: { reason: 'empty-conversation' } });
  });
});
