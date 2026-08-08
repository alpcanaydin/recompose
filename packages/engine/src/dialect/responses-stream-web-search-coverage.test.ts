import { describe, expect, test } from 'vitest';

import { newResponsesBlockState } from './responses-stream-state';
import { webSearchDoneEvents, webSearchOpening } from './responses-stream-web-search';

describe('opening a server-side web search block', () => {
  test('an item that is not a web search opens nothing', () => {
    expect(webSearchOpening(0, { type: 'function_call', call_id: 'call_1' })).toBeUndefined();
  });

  test('a search naming a call id keeps that identity', () => {
    expect(webSearchOpening(0, { type: 'web_search_call', call_id: 'ws_call' })).toMatchObject({
      opening: { name: 'web_search', signature: 'server:web-search' },
    });
  });

  test('a search naming only an item id falls back to that id', () => {
    const opening = webSearchOpening(2, { type: 'web_search_call', id: 'ws_item' });

    expect(opening).toMatchObject({ type: 'block-open', index: 2 });
    expect(JSON.stringify(opening)).toContain('ws_item');
  });

  test('a search naming no identity at all borrows its stream position', () => {
    expect(JSON.stringify(webSearchOpening(4, { type: 'web_search_call' }))).toContain(
      'toolu_stream_4',
    );
  });
});

describe('closing a server-side web search block', () => {
  test('an item that is not a web search closes nothing', () => {
    expect(webSearchDoneEvents(newResponsesBlockState(), 0, { type: 'function_call' })).toBeNull();
  });

  test('a search carrying a query reports the query before closing', () => {
    const state = newResponsesBlockState();

    state.open.add(0);

    const events = webSearchDoneEvents(state, 0, {
      type: 'web_search_call',
      call_id: 'ws_call',
      action: { query: 'recompose gateway' },
    });

    expect(events?.[0]).toMatchObject({ delta: { kind: 'json-args' } });
    expect(state.open.has(0)).toBe(false);
    expect(state.closed.has(0)).toBe(true);
  });

  test('a search carrying no query closes straight into its result block', () => {
    const events = webSearchDoneEvents(newResponsesBlockState(), 0, {
      type: 'web_search_call',
      call_id: 'ws_call',
    });

    expect(events?.[0]).toMatchObject({ type: 'block-close', index: 0 });
    expect(events?.[1]).toMatchObject({
      type: 'block-open',
      opening: { signature: 'server:web-search-result' },
    });
  });
});
