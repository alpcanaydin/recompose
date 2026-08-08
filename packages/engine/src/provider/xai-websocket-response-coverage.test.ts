import { describe, expect, it } from 'vitest';

import {
  requiresXAIWebSocketReplay,
  XAIWebSocketResponseIDs,
  xaiResponseIDsFor,
} from './xai-websocket-response';

function completion(response: Record<string, unknown>): unknown {
  return { type: 'response.completed', response };
}

describe('Carrying a xAI conversation reference upstream', () => {
  it('should leave a first request without a conversation reference alone', () => {
    const ids = new XAIWebSocketResponseIDs();

    expect(ids.prepareRequest({ model: 'grok-4.3' })).toEqual({ model: 'grok-4.3' });
  });

  it('should leave a blank conversation reference alone', () => {
    const ids = new XAIWebSocketResponseIDs();

    expect(ids.prepareRequest({ previous_response_id: '   ' })).toEqual({
      previous_response_id: '   ',
    });
  });

  it('should keep a conversation reference the gateway never handed out', () => {
    const ids = new XAIWebSocketResponseIDs();

    expect(ids.prepareRequest({ previous_response_id: 'resp_foreign' })).toEqual({
      previous_response_id: 'resp_foreign',
    });
  });

  it('should translate a repeated answer reference back to the upstream one', () => {
    const ids = new XAIWebSocketResponseIDs();

    ids.rewrite(completion({ id: 'resp_1' }));
    ids.rewrite(completion({ id: 'resp_1' }));

    expect(ids.prepareRequest({ previous_response_id: 'resp_1_recompose_2' })).toEqual({
      previous_response_id: 'resp_1',
    });
  });
});

describe('Handing distinct answer references downstream', () => {
  it('should pass an event that is not a completion through untouched', () => {
    const ids = new XAIWebSocketResponseIDs();

    expect(ids.rewrite({ type: 'response.created' })).toEqual({ type: 'response.created' });
  });

  it('should pass a completion without an answer body through untouched', () => {
    const ids = new XAIWebSocketResponseIDs();

    expect(ids.rewrite({ type: 'response.completed', response: 'gone' })).toEqual({
      type: 'response.completed',
      response: 'gone',
    });
  });

  it('should pass a value that is not an event through untouched', () => {
    const ids = new XAIWebSocketResponseIDs();

    expect(ids.rewrite('raw')).toBe('raw');
  });

  it('should pass a completion whose answer has no reference through untouched', () => {
    const ids = new XAIWebSocketResponseIDs();

    expect(ids.rewrite(completion({ model: 'grok-4.3' }))).toEqual(
      completion({ model: 'grok-4.3' }),
    );
  });

  it('should keep the upstream reference on the first completion', () => {
    const ids = new XAIWebSocketResponseIDs();

    expect(ids.rewrite(completion({ id: 'resp_1' }))).toHaveProperty('response.id', 'resp_1');
  });

  it('should distinguish a repeated upstream reference', () => {
    const ids = new XAIWebSocketResponseIDs();

    ids.rewrite(completion({ id: 'resp_1' }));

    expect(ids.rewrite(completion({ id: 'resp_1' }))).toHaveProperty(
      'response.id',
      'resp_1_recompose_2',
    );
  });

  it('should echo the conversation reference the caller sent', () => {
    const ids = new XAIWebSocketResponseIDs();

    ids.prepareRequest({ previous_response_id: 'resp_caller' });

    expect(ids.rewrite(completion({ id: 'resp_1' }))).toHaveProperty(
      'response.previous_response_id',
      'resp_caller',
    );
  });

  it('should leave out a conversation reference the caller never sent', () => {
    const ids = new XAIWebSocketResponseIDs();

    ids.prepareRequest({ model: 'grok-4.3' });

    expect(ids.rewrite(completion({ id: 'resp_1' }))).not.toHaveProperty(
      'response.previous_response_id',
    );
  });
});

describe('Rewriting the answer items of a xAI completion', () => {
  it('should carry the new reference into every item that names it', () => {
    const ids = new XAIWebSocketResponseIDs();

    ids.rewrite(completion({ id: 'resp_1' }));
    const rewritten = ids.rewrite(
      completion({ id: 'resp_1', output: [{ id: 'resp_1_item_0', type: 'message' }] }),
    );

    expect(rewritten).toHaveProperty('response.output.0.id', 'resp_1_recompose_2_item_0');
  });

  it('should leave an item that is not an object alone', () => {
    const ids = new XAIWebSocketResponseIDs();

    const rewritten = ids.rewrite(completion({ id: 'resp_1', output: ['raw'] }));

    expect(rewritten).toHaveProperty('response.output', ['raw']);
  });

  it('should leave an item that carries no reference alone', () => {
    const ids = new XAIWebSocketResponseIDs();

    const rewritten = ids.rewrite(completion({ id: 'resp_1', output: [{ type: 'message' }] }));

    expect(rewritten).toHaveProperty('response.output', [{ type: 'message' }]);
  });

  it('should leave an answer whose items are not a list alone', () => {
    const ids = new XAIWebSocketResponseIDs();

    const rewritten = ids.rewrite(completion({ id: 'resp_1', output: 'none' }));

    expect(rewritten).toHaveProperty('response.output', 'none');
  });

  it('should leave out the items when the answer carries none', () => {
    const ids = new XAIWebSocketResponseIDs();

    expect(ids.rewrite(completion({ id: 'resp_1' }))).not.toHaveProperty('response.output');
  });
});

describe('Holding one reference ledger per xAI session', () => {
  it('should hand back the same ledger for a session it already opened', () => {
    const states = new Map<string, XAIWebSocketResponseIDs>();
    const first = xaiResponseIDsFor(states, 'session-1');

    expect(xaiResponseIDsFor(states, 'session-1')).toBe(first);
  });

  it('should open a separate ledger for a separate session', () => {
    const states = new Map<string, XAIWebSocketResponseIDs>();

    expect(xaiResponseIDsFor(states, 'session-1')).not.toBe(xaiResponseIDsFor(states, 'session-2'));
  });
});

describe('Deciding whether a xAI request needs a replay', () => {
  it('should refuse a replay the session does not require', () => {
    expect(requiresXAIWebSocketReplay({ input: [{ type: 'compaction_trigger' }] }, false)).toBe(
      false,
    );
  });

  it('should refuse a replay for a request that carries no input list', () => {
    expect(requiresXAIWebSocketReplay({ input: 'hello' }, true)).toBe(false);
  });

  it('should refuse a replay for input that asks for no compaction', () => {
    expect(requiresXAIWebSocketReplay({ input: [{ role: 'user' }, 'raw'] }, true)).toBe(false);
  });

  it('should demand a replay for input that asks for compaction', () => {
    expect(requiresXAIWebSocketReplay({ input: [{ type: 'compaction_trigger' }] }, true)).toBe(
      true,
    );
  });
});
