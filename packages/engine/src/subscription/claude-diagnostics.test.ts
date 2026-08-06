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
