import { describe, expect, test } from 'vitest';

import type { JsonObject } from '../gateway-wire';

import { CodexReasoningReplay, observeCodexReasoning } from './codex-replay';

function reasoning(index: number): JsonObject {
  return { type: 'reasoning', encrypted_content: `signature-${String(index)}` };
}

function assistant(index: number): JsonObject {
  return { type: 'message', role: 'assistant', content: `answer-${String(index)}` };
}

function replayed(cache: CodexReasoningReplay, input: JsonObject[]): unknown[] {
  const value = cache.inject('scope', { input })['input'];

  return Array.isArray(value) ? value : [];
}

async function observeFailure(cache: CodexReasoningReplay, error: JsonObject): Promise<void> {
  const response = await observeCodexReasoning(
    new Response(`data: ${JSON.stringify({ type: 'response.failed', response: { error } })}\n\n`, {
      headers: { 'content-type': 'text/event-stream' },
    }),
    (output) => {
      cache.commit('scope', output);
    },
    () => {
      cache.clear('scope');
    },
  );

  await response.text();
}

describe('Codex reasoning replay state parity', () => {
  test('keeps prior replay when a completed turn has no replayable output', () => {
    const cache = new CodexReasoningReplay();

    cache.commit('scope', [reasoning(1), assistant(1)]);
    cache.commit('scope', []);

    expect(replayed(cache, [assistant(1)])[0]).toMatchObject({
      encrypted_content: 'signature-1',
    });
  });

  test('keeps only the latest 256 replay turns', () => {
    const cache = new CodexReasoningReplay();

    for (let index = 0; index < 257; index += 1) {
      cache.commit('scope', [reasoning(index), assistant(index)]);
    }

    const input = replayed(
      cache,
      Array.from({ length: 257 }, (_value, index) => assistant(index)),
    );
    const serialized = JSON.stringify(input);

    expect(serialized).not.toContain('signature-0');
    expect(serialized).toContain('signature-256');
  });

  test('clears only an invalid-signature terminal failure', async () => {
    const cache = new CodexReasoningReplay();

    cache.commit('scope', [reasoning(1), assistant(1)]);
    await observeFailure(cache, { type: 'server_error', code: 'upstream_error' });
    expect(replayed(cache, [assistant(1)])).toHaveLength(2);

    await observeFailure(cache, {
      type: 'invalid_request_error',
      code: 'invalid_encrypted_content',
      message: 'Invalid signature in thinking block',
    });
    expect(replayed(cache, [assistant(1)])).toEqual([assistant(1)]);
  });
});
