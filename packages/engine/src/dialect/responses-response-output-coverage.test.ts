import { describe, expect, it } from 'vitest';

import type { HubContentBlock } from './hub';
import type { ResponsesOutputItem } from './responses-wire';

import { decodeResponse } from './responses-codec';

function decodedContent(output: readonly ResponsesOutputItem[]): readonly HubContentBlock[] {
  const decoded = decodeResponse({ id: 'resp_1', status: 'completed', output });

  if ('refusal' in decoded) throw new Error('the Responses answer was refused');

  return decoded.value.content;
}

describe('a Responses web search call that never searched', () => {
  it('leaves nothing behind when the action is not a search', () => {
    const content = decodedContent([
      { type: 'web_search_call', id: 'ws_1', action: { type: 'open_page' } },
    ]);

    expect(content).toEqual([]);
  });

  it('leaves nothing behind when the search names no query', () => {
    const content = decodedContent([
      { type: 'web_search_call', id: 'ws_1', action: { type: 'search' } },
    ]);

    expect(content).toEqual([]);
  });
});

describe('a Responses web search call that arrives without an identity', () => {
  it('gives the paired tool blocks a shared fallback identity', () => {
    const content = decodedContent([
      { type: 'web_search_call', action: { type: 'search', query: 'otters' } },
    ]);

    const ids = content.flatMap((block) => (block.type === 'tool_use' ? [block.id] : []));

    expect(content[0]).toMatchObject({
      type: 'tool_use',
      name: 'web_search',
      input: { query: 'otters' },
    });
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(1);
  });
});

describe('a Responses image that names no output format', () => {
  it('reads the image as a PNG', () => {
    const content = decodedContent([
      { type: 'image_generation_call', id: 'img_1', result: 'AA==' },
    ]);

    expect(content).toEqual([
      { type: 'image', source: { type: 'base64', mediaType: 'image/png', data: 'AA==' } },
    ]);
  });
});
