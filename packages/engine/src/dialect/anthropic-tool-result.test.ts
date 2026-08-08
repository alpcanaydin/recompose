import { describe, expect, test } from 'vitest';

import type { AnthropicToolResultBlock } from './anthropic-wire';
import type { Fate } from './fates';

import { hubToolResultFrom } from './anthropic-tool-result';

function block(content: unknown): AnthropicToolResultBlock {
  return { type: 'tool_result', tool_use_id: 'call-1', content };
}

function translated(source: AnthropicToolResultBlock) {
  const fates: Fate[] = [];
  const value = hubToolResultFrom(source, fates);

  return { value, fates };
}

describe('a Claude tool result carries its content to the hub', () => {
  test('a bare string becomes a single text part', () => {
    expect(translated(block('the command succeeded')).value.content).toEqual([
      { type: 'text', text: 'the command succeeded' },
    ]);
  });

  test('an absent content yields no parts', () => {
    expect(translated(block(undefined)).value.content).toEqual([]);
  });

  test('a text part in an array is carried', () => {
    const parts = [{ type: 'text', text: 'line one' }];

    expect(translated(block(parts)).value.content).toEqual([{ type: 'text', text: 'line one' }]);
  });

  test('an image part addressed by URL is carried', () => {
    const parts = [{ type: 'image', source: { type: 'url', url: 'https://example.test/a.png' } }];

    expect(translated(block(parts)).value.content).toEqual([
      { type: 'image', source: { type: 'url', url: 'https://example.test/a.png' } },
    ]);
  });

  test('an inline base64 image is carried with its media type', () => {
    const source = { type: 'base64', media_type: 'image/png', data: 'AAAA' };

    expect(translated(block([{ type: 'image', source }])).value.content).toEqual([
      { type: 'image', source: { type: 'base64', mediaType: 'image/png', data: 'AAAA' } },
    ]);
  });

  test('the tool use it answers travels with it', () => {
    expect(translated(block('done')).value.toolUseId).toBe('call-1');
  });
});

describe('a Claude tool result part the hub cannot carry is accounted for', () => {
  test('a search result is dropped as cost bearing', () => {
    const parts = [{ type: 'search_result', content: [] }];

    expect(translated(block(parts)).fates).toEqual([
      {
        field: 'tool_result[search_result]',
        disposition: 'mapped',
        to: 'absent',
        costBearing: true,
      },
    ]);
  });

  test('a document is dropped as cost bearing', () => {
    const parts = [{ type: 'document', source: {} }];

    expect(translated(block(parts)).fates).toEqual([
      { field: 'tool_result[document]', disposition: 'mapped', to: 'absent', costBearing: true },
    ]);
  });

  test('a tool reference is dropped without cost', () => {
    const parts = [{ type: 'tool_reference', name: 'Bash' }];

    expect(translated(block(parts)).fates).toEqual([
      { field: 'tool_result[tool_reference]', disposition: 'mapped', to: 'absent' },
    ]);
  });

  test('an unknown part is dropped silently', () => {
    const result = translated(block([{ type: 'mystery' }]));

    expect(result.value.content).toEqual([]);
    expect(result.fates).toEqual([]);
  });

  test('a part that is not a record is dropped silently', () => {
    const result = translated(block(['plain', 42]));

    expect(result.value.content).toEqual([]);
    expect(result.fates).toEqual([]);
  });

  test('an image part with an unreadable source is dropped', () => {
    const parts = [{ type: 'image', source: { type: 'base64', media_type: 'image/png' } }];

    expect(translated(block(parts)).value.content).toEqual([]);
  });

  test('an image part without a source object is dropped', () => {
    expect(
      translated(block([{ type: 'image', source: 'https://example.test' }])).value.content,
    ).toEqual([]);
  });
});

describe('a Claude tool result object keeps its structure where it can', () => {
  test('an object without a type is kept as a structured result', () => {
    const result = translated(block({ exitCode: 0, stdout: 'ok' }));

    expect(result.value.structuredResult).toEqual({ exitCode: 0, stdout: 'ok' });
  });

  test('a typed object claims no structured result', () => {
    const result = translated(block({ type: 'text', text: 'inline' }));

    expect(result.value.structuredResult).toBeUndefined();
  });

  test('an image object is carried as an image rather than serialized', () => {
    const source = { type: 'url', url: 'https://example.test/a.png' };
    const result = translated(block({ type: 'image', source }));

    expect(result.value.content).toEqual([{ type: 'image', source }]);
  });

  test('an object with an unrecognized type is serialized whole', () => {
    const result = translated(block({ type: 'mystery', payload: 1 }));

    expect(result.value.content).toEqual([
      { type: 'text', text: JSON.stringify({ type: 'mystery', payload: 1 }) },
    ]);
  });
});

describe('a Claude tool result carries its caching and error standing', () => {
  test('an ephemeral cache breakpoint travels without a lifetime', () => {
    const source: AnthropicToolResultBlock = {
      type: 'tool_result',
      tool_use_id: 'call-1',
      content: 'done',
      cache_control: { type: 'ephemeral' },
    };

    expect(translated(source).value.cacheBreakpoint).toEqual({ type: 'ephemeral' });
  });

  test('a cache breakpoint keeps the lifetime it was given', () => {
    const source: AnthropicToolResultBlock = {
      type: 'tool_result',
      tool_use_id: 'call-1',
      content: 'done',
      cache_control: { type: 'ephemeral', ttl: '1h' },
    };

    expect(translated(source).value.cacheBreakpoint).toEqual({ type: 'ephemeral', ttl: '1h' });
  });

  test('a failed tool result is marked as an error', () => {
    const source: AnthropicToolResultBlock = {
      type: 'tool_result',
      tool_use_id: 'call-1',
      content: 'the command failed',
      is_error: true,
    };

    expect(translated(source).value.isError).toBe(true);
  });

  test('a successful tool result carries no error mark', () => {
    const source: AnthropicToolResultBlock = {
      type: 'tool_result',
      tool_use_id: 'call-1',
      content: 'done',
      is_error: false,
    };

    expect(translated(source).value.isError).toBeUndefined();
  });
});

describe('a Claude tool result the hub cannot read carries nothing', () => {
  test('a scalar result carries no content', () => {
    expect(translated(block(42)).value.content).toEqual([]);
  });

  test('a scalar result carries no structured result either', () => {
    expect(translated(block(42)).value.structuredResult).toBeUndefined();
  });
});
