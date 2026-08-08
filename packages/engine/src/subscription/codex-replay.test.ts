import { describe, expect, test } from 'vitest';

import {
  codexCredential,
  runtimeAnswering,
  subscriptionGrant,
} from '../gateway-proxy-subscription.testkit';
import { parsedJson } from '../gateway-wire';
import { CodexReasoningReplay, observeCodexReasoning } from './codex-replay';
import { reachSubscription } from './reach';

const reasoning = {
  type: 'reasoning',
  id: 'rs_1',
  encrypted_content:
    'gAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
};
const assistant = {
  type: 'message',
  role: 'assistant',
  content: [{ type: 'output_text', text: 'answer' }],
};

function replayAnswerSequence(): () => Response {
  let sent = 0;

  return () => {
    sent += 1;

    return sent === 1
      ? new Response(
          `data: ${JSON.stringify({ type: 'response.completed', response: { output: [reasoning, assistant] } })}\n\n`,
          { headers: { 'content-type': 'text/event-stream' } },
        )
      : Response.json({ id: 'response_2', status: 'completed', output: [] });
  };
}

function resolvedCodexGrant() {
  const grant = subscriptionGrant('openai', codexCredential());

  if (grant.verdict !== 'resolved') {
    throw new Error('the test grant was not resolved');
  }

  return grant;
}

function sentBody(answering: ReturnType<typeof runtimeAnswering>, at: number): unknown {
  const body = answering.sent[at]?.request.body;

  return typeof body === 'string' ? parsedJson(body) : undefined;
}

describe('Codex reasoning replay continuity', () => {
  test('injects cached encrypted reasoning before matching Claude assistant history', () => {
    const cache = new CodexReasoningReplay();

    cache.commit('gpt-5.4\0session', [reasoning, assistant]);
    const body = cache.inject('gpt-5.4\0session', {
      input: [
        { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'hello' }] },
        assistant,
        { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'next' }] },
      ],
    });

    expect(body['input']).toEqual([
      { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'hello' }] },
      { ...reasoning, summary: [], content: null },
      assistant,
      { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'next' }] },
    ]);
  });

  test('does not duplicate reasoning already carried by a native-capable history', () => {
    const cache = new CodexReasoningReplay();

    cache.commit('scope', [reasoning, assistant]);
    const body = cache.inject('scope', { input: [reasoning, assistant] });

    expect(body['input']).toEqual([reasoning, assistant]);
  });
});

describe('cumulative Codex reasoning replay', () => {
  test('restores cumulative turns at their newest matching assistant anchors', () => {
    const cache = new CodexReasoningReplay();
    const olderReasoning = { ...reasoning, id: 'rs_old', encrypted_content: 'older-state' };
    const olderAssistant = {
      ...assistant,
      content: [{ type: 'output_text', text: 'older answer' }],
    };

    cache.commit('scope', [olderReasoning, olderAssistant]);
    cache.commit('scope', [reasoning, assistant]);
    const body = cache.inject('scope', {
      input: [olderAssistant, assistant, assistant, { type: 'message', role: 'user', content: [] }],
    });

    expect(body['input']).toEqual([
      { ...olderReasoning, summary: [], content: null },
      olderAssistant,
      assistant,
      { ...reasoning, summary: [], content: null },
      assistant,
      { type: 'message', role: 'user', content: [] },
    ]);
  });

  test('commits only a completed SSE response and clears failed state', async () => {
    const committed: unknown[] = [];
    let cleared = 0;
    const response = new Response(
      `data: ${JSON.stringify({ type: 'response.completed', response: { output: [reasoning, assistant] } })}\n\n`,
      { headers: { 'content-type': 'text/event-stream' } },
    );

    await (
      await observeCodexReasoning(
        response,
        (output) => {
          committed.push(output);
        },
        () => {
          cleared += 1;
        },
      )
    ).text();
    expect(committed).toEqual([[reasoning, assistant]]);
    expect(cleared).toBe(0);
  });
});

describe('Codex subscription reasoning replay', () => {
  test('stores a completed turn and injects it into the next Claude request', async () => {
    const answering = runtimeAnswering(replayAnswerSequence());
    const runtime = { ...answering.runtime, codexReplay: new CodexReasoningReplay() };
    const grant = resolvedCodexGrant();

    await (
      await reachSubscription(
        grant,
        { model: 'gpt-5.4', input: [{ type: 'message', role: 'user', content: [] }] },
        runtime,
        'same-session',
        'anthropic',
      )
    ).text();
    await reachSubscription(
      grant,
      { model: 'gpt-5.4', input: [assistant, { type: 'message', role: 'user', content: [] }] },
      runtime,
      'same-session',
      'anthropic',
    );

    expect(sentBody(answering, 1)).toHaveProperty(
      'input.0.encrypted_content',
      reasoning.encrypted_content,
    );
    expect(sentBody(answering, 1)).toHaveProperty('input.1.content.0.text', 'answer');
  });
});
