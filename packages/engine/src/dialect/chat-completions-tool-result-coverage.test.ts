import { describe, expect, test } from 'vitest';

import { toolResultBlockFrom } from './chat-completions-tool-result';

describe('naming the tool call a chat tool message answers', () => {
  test('a message naming its call keeps that identity', () => {
    expect(
      toolResultBlockFrom({ role: 'tool', tool_call_id: 'call_1', content: 'done' }),
    ).toMatchObject({ toolUseId: 'call_1' });
  });

  test('a message naming no call falls back to a placeholder identity', () => {
    expect(toolResultBlockFrom({ role: 'tool', content: 'done' })).toMatchObject({
      toolUseId: 'call_missing',
    });
  });
});

describe('reading the content a chat tool message carries', () => {
  test('plain text arrives as a single text block', () => {
    expect(toolResultBlockFrom({ role: 'tool', content: 'done' }).content).toEqual([
      { type: 'text', text: 'done' },
    ]);
  });

  test('an entry that is not an object is carried as its JSON text', () => {
    const block = toolResultBlockFrom({ role: 'tool', content: [42] });

    expect(block.content).toEqual([{ type: 'text', text: '42' }]);
    expect(block.structuredResult).toEqual([{ type: 'input_text', text: '42' }]);
  });

  test('a text entry without any text is carried as its JSON text', () => {
    expect(toolResultBlockFrom({ role: 'tool', content: [{ type: 'text' }] }).content).toEqual([
      { type: 'text', text: '{"type":"text"}' },
    ]);
  });

  test('a text entry with text is carried as a text block', () => {
    expect(
      toolResultBlockFrom({ role: 'tool', content: [{ type: 'text', text: 'done' }] }).content,
    ).toEqual([{ type: 'text', text: 'done' }]);
  });

  test('an object result is carried as its JSON text', () => {
    expect(toolResultBlockFrom({ role: 'tool', content: { rows: 2 } }).content).toEqual([
      { type: 'text', text: '{"rows":2}' },
    ]);
  });

  test('a cache marker travels with the result', () => {
    expect(
      toolResultBlockFrom({ role: 'tool', content: 'done', cache_control: { type: 'ephemeral' } }),
    ).toMatchObject({ cacheBreakpoint: { type: 'ephemeral' } });
  });
});
