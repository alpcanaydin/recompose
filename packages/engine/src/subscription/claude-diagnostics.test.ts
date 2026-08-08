import { describe, expect, it } from 'vitest';

import {
  ClaudeDiagnostics,
  injectClaudeDiagnostics,
  observeClaudeDiagnostics,
} from './claude-diagnostics';

describe('Claude diagnostics continuity', () => {
  it('injects diagnostics after context management and advances on JSON success', async () => {
    const state = new ClaudeDiagnostics();
    const first = injectClaudeDiagnostics(
      { context_management: { edits: [] }, max_tokens: 1, messages: [] },
      state.previous('credential\0session'),
    );

    expect(JSON.stringify(first)).toContain(
      '"context_management":{"edits":[]},"diagnostics":{"previous_message_id":null},"max_tokens"',
    );
    await observeClaudeDiagnostics(Response.json({ id: 'msg_1' }), (id) => {
      state.commit('credential\0session', id);
    });
    expect(
      injectClaudeDiagnostics({ messages: [] }, state.previous('credential\0session')),
    ).toEqual({
      diagnostics: { previous_message_id: 'msg_1' },
      messages: [],
    });
  });
});

describe('committing Claude diagnostic responses', () => {
  it('commits SSE identity only after message_stop', async () => {
    const committed: string[] = [];
    const complete = new Response(
      'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_complete"}}\n\n' +
        'event: message_stop\ndata: {"type":"message_stop"}\n\n',
      { headers: { 'content-type': 'text/event-stream' } },
    );
    const incomplete = new Response(
      'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_partial"}}\n\n',
      { headers: { 'content-type': 'text/event-stream' } },
    );

    await (
      await observeClaudeDiagnostics(complete, (id) => {
        committed.push(id);
      })
    ).text();
    await (
      await observeClaudeDiagnostics(incomplete, (id) => {
        committed.push(id);
      })
    ).text();
    expect(committed).toEqual(['msg_complete']);
  });

  it('does not advance on an unsuccessful JSON response', async () => {
    const committed: string[] = [];
    const response = Response.json({ id: 'msg_failed' }, { status: 500 });

    await observeClaudeDiagnostics(response, (id) => {
      committed.push(id);
    });
    expect(committed).toEqual([]);
  });
});

describe('holding back a Claude diagnostic advance', () => {
  it('does not advance on a response that carries no body', async () => {
    const committed: string[] = [];

    await observeClaudeDiagnostics(new Response(null, { status: 200 }), (id) => {
      committed.push(id);
    });
    expect(committed).toEqual([]);
  });

  it('does not advance on a JSON response that cannot be read', async () => {
    const committed: string[] = [];
    const response = new Response('not json', {
      headers: { 'content-type': 'application/json' },
    });

    await observeClaudeDiagnostics(response, (id) => {
      committed.push(id);
    });
    expect(committed).toEqual([]);
  });

  it('does not advance on a JSON response whose identity is blank', async () => {
    const committed: string[] = [];

    await observeClaudeDiagnostics(Response.json({ id: '' }), (id) => {
      committed.push(id);
    });
    await observeClaudeDiagnostics(Response.json({ id: 7 }), (id) => {
      committed.push(id);
    });
    await observeClaudeDiagnostics(Response.json('plain'), (id) => {
      committed.push(id);
    });
    expect(committed).toEqual([]);
  });
});

describe('reading a Claude diagnostic stream', () => {
  it('ignores stream lines it cannot read as an event', async () => {
    const committed: string[] = [];
    const response = new Response(
      'data: {"type":"message_start"\n\n' +
        'data: {"type":"message_start","message":"gone"}\n\n' +
        'data: {"type":"message_stop"}\n\n',
      { headers: { 'content-type': 'text/event-stream' } },
    );

    await (
      await observeClaudeDiagnostics(response, (id) => {
        committed.push(id);
      })
    ).text();
    expect(committed).toEqual([]);
  });

  it('ignores a stream that stops without ever naming a message', async () => {
    const committed: string[] = [];
    const response = new Response('data: {"type":"message_stop"}\n\n', {
      headers: { 'content-type': 'text/event-stream' },
    });

    await (
      await observeClaudeDiagnostics(response, (id) => {
        committed.push(id);
      })
    ).text();
    expect(committed).toEqual([]);
  });

  it('ignores a message start that names no identity', async () => {
    const committed: string[] = [];
    const response = new Response(
      'data: {"type":"message_start","message":{}}\ndata: {"type":"message_stop"}\n',
      { headers: { 'content-type': 'text/event-stream' } },
    );

    await (
      await observeClaudeDiagnostics(response, (id) => {
        committed.push(id);
      })
    ).text();
    expect(committed).toEqual([]);
  });
});

describe('placing the Claude diagnostics field', () => {
  it('places diagnostics first when the request manages no context', () => {
    const injected = injectClaudeDiagnostics({ max_tokens: 1, messages: [] }, 'msg_1');

    expect(JSON.stringify(injected)).toBe(
      '{"diagnostics":{"previous_message_id":"msg_1"},"max_tokens":1,"messages":[]}',
    );
  });

  it('replaces diagnostics the caller sent', () => {
    const injected = injectClaudeDiagnostics(
      { diagnostics: { previous_message_id: 'msg_caller' }, messages: [] },
      null,
    );

    expect(injected).toEqual({ diagnostics: { previous_message_id: null }, messages: [] });
  });
});

describe('bounding the Claude diagnostics ledger', () => {
  it('forgets the oldest session once the ledger is full', () => {
    const state = new ClaudeDiagnostics();

    for (let index = 0; index <= 4096; index += 1) {
      state.commit(`session-${String(index)}`, `msg_${String(index)}`);
    }

    expect(state.previous('session-0')).toBeNull();
    expect(state.previous('session-4096')).toBe('msg_4096');
  });
});
