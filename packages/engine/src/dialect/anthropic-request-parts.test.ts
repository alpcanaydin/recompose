import { describe, expect, it } from 'vitest';

import { anAnthropicAsk, decodedValue } from './anthropic.testkit';

describe('a search_result part folds away named rather than corrupting', () => {
  it('folds a search_result part away cost-bearing, keeping the text beside it', () => {
    const { value, fates } = decodedValue(
      anAnthropicAsk({
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'toolu_01',
                content: [
                  {
                    type: 'search_result',
                    title: 'Weather in Paris',
                    source: 'https://weather.example/paris',
                    content: [{ type: 'text', text: 'sunny, 21C' }],
                  },
                  { type: 'text', text: 'summarized: sunny' },
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
        content: [{ type: 'text', text: 'summarized: sunny' }],
      },
    ]);
    expect(fates).toContainEqual({
      field: 'tool_result[search_result]',
      disposition: 'mapped',
      to: 'absent',
      costBearing: true,
    });
  });
});

describe('a document part folds away named rather than posing as an image', () => {
  it('folds a document part away cost-bearing rather than relabeling it an image', () => {
    const { value, fates } = decodedValue(
      anAnthropicAsk({
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'toolu_01',
                content: [
                  {
                    type: 'document',
                    source: { type: 'base64', media_type: 'application/pdf', data: 'JVBERi0=' },
                  },
                ],
              },
            ],
          },
        ],
      }),
    );

    expect(value.messages.at(0)?.content).toStrictEqual([
      { type: 'tool_result', toolUseId: 'toolu_01', content: [] },
    ]);
    expect(fates).toContainEqual({
      field: 'tool_result[document]',
      disposition: 'mapped',
      to: 'absent',
      costBearing: true,
    });
  });
});

describe('a tool_reference part folds away named rather than throwing', () => {
  it('folds a tool_reference part away with a plain fate, never a thrown error', () => {
    const { value, fates } = decodedValue(
      anAnthropicAsk({
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'toolu_01',
                content: [{ type: 'tool_reference', tool_name: 'get_weather' }],
              },
            ],
          },
        ],
      }),
    );

    expect(value.messages.at(0)?.content).toStrictEqual([
      { type: 'tool_result', toolUseId: 'toolu_01', content: [] },
    ]);
    expect(fates).toContainEqual({
      field: 'tool_result[tool_reference]',
      disposition: 'mapped',
      to: 'absent',
    });
  });
});
