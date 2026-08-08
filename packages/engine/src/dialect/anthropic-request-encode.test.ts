import { describe, expect, it } from 'vitest';

import { encodeRequest } from './anthropic-request';
import { aHubImageBlock, aHubRequest, aHubTool, aHubToolResultBlock } from './hub.testkit';

describe('encodeRequest writes exactly what the hub carries', () => {
  it('writes a minimal hub request as messages and the injected ceiling alone', () => {
    const { value, fates } = encodeRequest(aHubRequest());

    expect(value).toStrictEqual({
      max_tokens: 4096,
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hello from the hub' }] }],
    });
    expect(fates).toStrictEqual([
      { field: 'sampling.maxOutputTokens', disposition: 'mapped', to: 'max_tokens (default)' },
    ]);
  });

  it('writes a ceiling-only sampling without inventing the other knobs', () => {
    const { value, fates } = encodeRequest(aHubRequest({ sampling: { maxOutputTokens: 512 } }));

    expect(value).toStrictEqual({
      max_tokens: 512,
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hello from the hub' }] }],
    });
    expect(fates).toStrictEqual([]);
  });
});

describe('encodeRequest invents nothing the hub never named', () => {
  it('writes an empty system list as no system field at all', () => {
    const { value } = encodeRequest(aHubRequest({ system: [] }));

    expect(value.system).toBeUndefined();
  });

  it('writes a bare tool without inventing a description or required list', () => {
    const { value } = encodeRequest(
      aHubRequest({ tools: [{ name: 'bash', inputSchema: { type: 'object', properties: {} } }] }),
    );

    expect(value.tools).toStrictEqual([
      { name: 'bash', input_schema: { type: 'object', properties: {} } },
    ]);
  });
});

describe('encodeRequest writes the hub envelope onto the wire', () => {
  it('writes system texts as wire text blocks with their breakpoints', () => {
    const { value } = encodeRequest(
      aHubRequest({
        system: [{ text: 'You answer concisely.', cacheBreakpoint: { type: 'ephemeral' } }],
      }),
    );

    expect(value.system).toEqual([
      { type: 'text', text: 'You answer concisely.', cache_control: { type: 'ephemeral' } },
    ]);
  });

  it('writes a hub tool with its input_schema and required list', () => {
    const { value } = encodeRequest(
      aHubRequest({
        tools: [
          aHubTool({
            inputSchema: {
              type: 'object',
              properties: { city: { type: 'string' } },
              required: ['city'],
            },
          }),
        ],
      }),
    );

    expect(value.tools).toStrictEqual([
      {
        name: 'get_weather',
        description: 'Look up the weather for a city',
        input_schema: {
          type: 'object',
          properties: { city: { type: 'string' } },
          required: ['city'],
        },
      },
    ]);
  });
});

describe('encodeRequest writes the message blocks in their wire shapes', () => {
  it('writes a tool_result back under its wire names', () => {
    const { value } = encodeRequest(
      aHubRequest({ messages: [{ role: 'user', content: [aHubToolResultBlock()] }] }),
    );

    expect(value.messages).toStrictEqual([
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_weather',
            content: [{ type: 'text', text: 'sunny, 21C' }],
          },
        ],
      },
    ]);
  });

  it('writes an erroring tool_result with its is_error mark', () => {
    const { value } = encodeRequest(
      aHubRequest({
        messages: [{ role: 'user', content: [aHubToolResultBlock({ isError: true })] }],
      }),
    );

    expect(value.messages.at(0)?.content.at(0)).toMatchObject({ is_error: true });
  });
});

describe('encodeRequest writes the image lanes in their wire shapes', () => {
  it('writes images and unsigned thinking in their wire shapes', () => {
    const { value } = encodeRequest(
      aHubRequest({
        messages: [
          {
            role: 'assistant',
            content: [aHubImageBlock(), { type: 'thinking', text: 'quietly' }],
          },
        ],
      }),
    );

    expect(value.messages.at(0)?.content).toStrictEqual([
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'aGVsbG8=' } },
      { type: 'thinking', thinking: 'quietly' },
    ]);
  });

  it('writes a url image source back as a url, never a base64 shell', () => {
    const { value } = encodeRequest(
      aHubRequest({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'url', url: 'https://images.example/sky.png' } },
            ],
          },
        ],
      }),
    );

    expect(value.messages.at(0)?.content).toStrictEqual([
      { type: 'image', source: { type: 'url', url: 'https://images.example/sky.png' } },
    ]);
  });
});

describe('encodeRequest writes the tool_result answer forms', () => {
  it('writes an image answer inside a tool_result as a wire image part', () => {
    const { value } = encodeRequest(
      aHubRequest({
        messages: [
          {
            role: 'user',
            content: [aHubToolResultBlock({ content: [aHubImageBlock()] })],
          },
        ],
      }),
    );

    expect(value.messages.at(0)?.content).toStrictEqual([
      {
        type: 'tool_result',
        tool_use_id: 'toolu_weather',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'aGVsbG8=' } },
        ],
      },
    ]);
  });
});

describe('encodeRequest writes the choice and sampling knobs', () => {
  it.each([
    [{ type: 'auto' } as const, { type: 'auto' }],
    [{ type: 'none' } as const, { type: 'none' }],
    [{ type: 'required' } as const, { type: 'any' }],
    [{ type: 'tool', name: 'get_weather' } as const, { type: 'tool', name: 'get_weather' }],
  ])('writes the hub tool choice %j as the wire %j', (hub, wire) => {
    const { value } = encodeRequest(aHubRequest({ toolChoice: hub }));

    expect(value.tool_choice).toEqual(wire);
  });

  it('writes the sampling knobs under their wire names', () => {
    const { value } = encodeRequest(
      aHubRequest({
        sampling: { maxOutputTokens: 512, temperature: 0.4, topP: 0.9, stop: ['\n\n'] },
      }),
    );

    expect(value.max_tokens).toBe(512);
    expect(value.temperature).toBe(0.4);
    expect(value.top_p).toBe(0.9);
    expect(value.stop_sequences).toEqual(['\n\n']);
  });

  it('injects the wire-required max_tokens when the hub names no ceiling', () => {
    const { value, fates } = encodeRequest(aHubRequest());

    expect(value.max_tokens).toBe(4096);
    expect(fates).toContainEqual({
      field: 'sampling.maxOutputTokens',
      disposition: 'mapped',
      to: 'max_tokens (default)',
    });
  });

  it('leaves a web-search tool choice to the model, because the wire cannot name it', () => {
    const { value } = encodeRequest(aHubRequest({ toolChoice: { type: 'web_search' } }));

    expect(value.tool_choice).toEqual({ type: 'auto' });
  });
});
