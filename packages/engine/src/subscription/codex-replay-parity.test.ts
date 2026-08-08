import { describe, expect, test } from 'vitest';

import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';
import {
  CodexReasoningReplay,
  codexReplayPrefixFingerprint,
  observeCodexReasoning,
} from './codex-replay';

const validSignature =
  'gAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function reasoning(id: string, encryptedContent: string): JsonObject {
  return { type: 'reasoning', id, summary: [], encrypted_content: encryptedContent };
}

function assistant(text: string): JsonObject {
  return {
    type: 'message',
    role: 'assistant',
    content: [{ type: 'output_text', text }],
  };
}

function user(text: string): JsonObject {
  return { type: 'message', role: 'user', content: text };
}

function call(callId: string): JsonObject {
  return { type: 'function_call', call_id: callId, name: 'lookup', arguments: '{}' };
}

function output(callId: string): JsonObject {
  return { type: 'function_call_output', call_id: callId, output: 'ok' };
}

function replayedInput(cache: CodexReasoningReplay, key: string, input: JsonObject[]): unknown[] {
  const value = cache.inject(key, { input })['input'];

  return Array.isArray(value) ? value : [];
}

function sse(events: JsonObject[]): Response {
  const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');

  return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
}

async function observeInto(cache: CodexReasoningReplay, key: string, events: JsonObject[]) {
  const response = await observeCodexReasoning(
    sse(events),
    (value) => {
      cache.commit(key, value);
    },
    () => {
      cache.clear(key);
    },
  );

  await response.text();
}

function itemType(item: unknown): unknown {
  return isJsonObject(item) ? item['type'] : undefined;
}

describe('Codex reasoning replay observation parity', () => {
  test('TestCodexExecutorReasoningReplayCacheStoresFinalDoneAndInjectsNextClaudeRequest', async () => {
    const cache = new CodexReasoningReplay();
    const final = reasoning('rs_done', 'final-signature');

    await observeInto(cache, 'scope', [
      { type: 'response.output_item.added', output_index: 0, item: reasoning('rs_added', 'early') },
      { type: 'response.output_item.done', output_index: 0, item: final },
      { type: 'response.completed', response: { output: [] } },
    ]);

    expect(replayedInput(cache, 'scope', [user('next')])).toEqual([
      { ...final, content: null },
      user('next'),
    ]);
  });

  test('TestCodexExecutorReasoningReplayCacheDoesNotDuplicateClaudeClientReasoning', () => {
    const cache = new CodexReasoningReplay();

    cache.commit('scope', [reasoning('cached', 'cached-signature'), assistant('answer')]);

    expect(
      replayedInput(cache, 'scope', [reasoning('client', validSignature), assistant('answer')]),
    ).toEqual([reasoning('client', validSignature), assistant('answer')]);
  });
});

describe('Codex reasoning replay stream parity', () => {
  test('TestCodexExecutorReasoningReplayCacheExecuteStreamStoresFinalDoneForClaude', async () => {
    const cache = new CodexReasoningReplay();
    const done = reasoning('rs_stream', 'stream-signature');
    const response = await observeCodexReasoning(
      sse([
        { type: 'response.output_item.done', output_index: 0, item: done },
        { type: 'response.completed', response: { output: [] } },
      ]),
      (value) => {
        cache.commit('stream', value);
      },
      () => {
        cache.clear('stream');
      },
    );

    const reader = response.body?.getReader();

    while ((await reader?.read())?.done === false) {
      // Consume the streamed observer incrementally.
    }

    expect(replayedInput(cache, 'stream', [user('next')])[0]).toMatchObject({
      encrypted_content: 'stream-signature',
    });
  });
});

describe('Codex reasoning replay tool parity', () => {
  test('TestCodexExecutorReasoningReplayCacheReplaysFunctionCallForClaudeToolResult', () => {
    const cache = new CodexReasoningReplay();

    cache.commit('scope', [reasoning('rs_1', 'sig-1'), call('call_1')], { input: [user('call')] });

    expect(replayedInput(cache, 'scope', [user('call'), output('call_1')])).toEqual([
      user('call'),
      { ...reasoning('rs_1', 'sig-1'), content: null },
      call('call_1'),
      output('call_1'),
    ]);
  });

  test('TestCodexExecutorReasoningReplayCacheRestoresCumulativeToolTurns', () => {
    const cache = new CodexReasoningReplay();

    cache.commit('scope', [reasoning('rs_1', 'sig-1'), call('call_1')], { input: [user('first')] });
    cache.commit('scope', [reasoning('rs_2', 'sig-2'), call('call_2')], {
      input: [user('first'), output('call_1'), user('second')],
    });

    expect(
      replayedInput(cache, 'scope', [
        user('first'),
        output('call_1'),
        user('second'),
        output('call_2'),
        user('third'),
      ]).map(itemType),
    ).toEqual([
      'message',
      'reasoning',
      'function_call',
      'function_call_output',
      'message',
      'reasoning',
      'function_call',
      'function_call_output',
      'message',
    ]);
  });
});

describe('Codex reasoning replay duplicate history parity', () => {
  test('TestCodexExecutorReasoningReplayCacheMatchesNewestDuplicateAssistantAfterCompaction', () => {
    const cache = new CodexReasoningReplay();

    cache.commit('scope', [reasoning('old', 'old-signature'), assistant('Done')]);
    cache.commit('scope', [reasoning('new', 'new-signature'), assistant('Done')]);
    const input = replayedInput(cache, 'scope', [user('summary'), assistant('Done'), user('next')]);

    expect(input).toContainEqual(expect.objectContaining({ encrypted_content: 'new-signature' }));
    expect(input).not.toContainEqual(
      expect.objectContaining({ encrypted_content: 'old-signature' }),
    );
  });

  test('TestCodexExecutorReasoningReplayCacheUsesRequestPrefixForDuplicateOutOfOrderTurns', () => {
    const cache = new CodexReasoningReplay();
    const firstPrefix = [user('first')];
    const secondPrefix = [user('first'), assistant('Done'), user('second')];

    cache.commit('scope', [reasoning('new', 'new-signature'), assistant('Done')], {
      input: secondPrefix,
    });
    cache.commit('scope', [reasoning('old', 'old-signature'), assistant('Done')], {
      input: firstPrefix,
    });
    const input = replayedInput(cache, 'scope', [
      ...firstPrefix,
      assistant('Done'),
      user('second'),
      assistant('Done'),
      user('third'),
    ]);

    expect(input).toEqual([
      user('first'),
      expect.objectContaining({ encrypted_content: 'old-signature' }),
      assistant('Done'),
      user('second'),
      expect.objectContaining({ encrypted_content: 'new-signature' }),
      assistant('Done'),
      user('third'),
    ]);
  });
});

describe('Codex reasoning replay identity parity', () => {
  test('TestCodexExecutorReasoningReplayCacheMatchesShortenedClaudeToolResultCallID', () => {
    const cache = new CodexReasoningReplay();
    const long = `call_${'a'.repeat(62)}`;
    const shortened = 'call_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa_bcbd99a0abf4e8b3';

    cache.commit('scope', [reasoning('rs_1', 'sig-1'), call(long)], { input: [user('call')] });
    const input = replayedInput(cache, 'scope', [user('call'), output(shortened)]);

    expect(input[1]).toMatchObject({ type: 'reasoning' });
    expect(input[2]).toMatchObject({ type: 'function_call', call_id: shortened });
    expect(input[3]).toEqual(output(shortened));
  });

  test('TestCodexReplayPrefixFingerprintsMatchesDirectComputation', () => {
    const items = [user('a'), reasoning('rs_1', 'abc'), call('call_1'), output('call_1')];
    const expected = [
      '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
      '3177e9260723797eb2352a507c558c37e00238b2a7da7fffbb792a5067c9643a',
      '31bc4c62e709c6678eaf61bc9d5224e284c307ba7a3eebd76cd1c2c68d8a3454',
      '2098d715b3e69e2b5f9d330a6a3d562ecd6e4f2668fc5d9a2a216767922499e8',
      'b884b45478f760d6501e7a467213e93c8b189925b932ed5ff62942bea6ce89bc',
    ];

    expect(expected.map((_value, end) => codexReplayPrefixFingerprint(items, end))).toEqual(
      expected,
    );
    expect(codexReplayPrefixFingerprint(items, -1)).toBe('');
    expect(codexReplayPrefixFingerprint(items, 5)).toBe('');
  });
});
