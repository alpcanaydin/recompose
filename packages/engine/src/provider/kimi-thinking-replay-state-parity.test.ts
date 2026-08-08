import { expect, test } from 'vitest';

import { isJsonObject } from '../gateway-wire';
import { KimiThinkingReplay } from './kimi-thinking-replay';

test('TestKimiThinkingReplayConditionalDeleteKeepsNewerContent', () => {
  const replay = new KimiThinkingReplay();

  replay.commit('k3', 'scope', content('A'));
  const stale = replay.snapshot('k3', 'scope');

  replay.commit('k3', 'scope', content('B'));

  expect(replay.deleteIfUnchanged('k3', 'scope', stale)).toBe(false);
  expect(injectedSignature(replay)).toBe('B');
});

test('TestKimiThinkingReplayConditionalReplaceKeepsConcurrentContent', () => {
  const replay = new KimiThinkingReplay();

  replay.commit('k3', 'scope', content('A'));
  const stale = replay.snapshot('k3', 'scope');

  replay.commit('k3', 'scope', content('B'));

  expect(replay.replaceIfUnchanged('k3', 'scope', stale, content('stale'))).toBe(false);
  expect(injectedSignature(replay)).toBe('B');
});

test('TestKimiThinkingReplayTombstoneFencesConcurrentMiss', () => {
  const replay = new KimiThinkingReplay();
  const first = replay.snapshot('k3', 'scope');
  const second = replay.snapshot('k3', 'scope');

  expect(replay.deleteIfUnchanged('k3', 'scope', first)).toBe(true);
  expect(replay.replaceIfUnchanged('k3', 'scope', second, content('stale'))).toBe(false);
});

test('TestKimiThinkingReplayHomeGenerationPreventsABADelete', () => {
  const replay = new KimiThinkingReplay();

  replay.commit('k3', 'scope', content('A'));
  const stale = replay.snapshot('k3', 'scope');

  replay.commit('k3', 'scope', content('B'));
  replay.commit('k3', 'scope', content('A'));

  expect(replay.deleteIfUnchanged('k3', 'scope', stale)).toBe(false);
  expect(injectedSignature(replay)).toBe('A');
});

test('TestKimiThinkingReplayTracksAggregateLocalBytes', () => {
  const replay = new KimiThinkingReplay();

  replay.commit('k3', 'one', content('first'));
  const firstBytes = replay.totalBytes();

  replay.commit('k3', 'two', content('second'));

  expect(replay.totalBytes()).toBeGreaterThan(firstBytes);
  replay.clear('k3', 'one');
  expect(replay.totalBytes()).toBeLessThan(firstBytes + replay.totalBytes());
  replay.clearAll();
  expect(replay.totalBytes()).toBe(0);
});

test('TestKimiThinkingReplayRejectsOversizedContent', () => {
  const replay = new KimiThinkingReplay();
  const oversized = content('x'.repeat(8 * 1024 * 1024));

  expect(replay.commit('k3', 'scope', oversized)).toBe(false);
});

function content(signature: string) {
  return [
    { type: 'thinking', thinking: 'reason', signature },
    { type: 'tool_use', id: 'tool-1', name: 'run', input: {} },
  ];
}

function injectedSignature(replay: KimiThinkingReplay): unknown {
  const body = {
    messages: [
      {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'tool-1', name: 'run', input: {} }],
      },
    ],
  };
  const injected = replay.inject('k3', 'scope', body);
  const message = firstMessage(injected.body['messages']);

  return message === null ? undefined : signatureFromContent(message['content']);
}

function firstMessage(value: unknown): Record<string, unknown> | null {
  if (!Array.isArray(value)) return null;

  const messages: unknown[] = Array.from(value);
  const message = messages[0];

  return isJsonObject(message) ? message : null;
}

function signatureFromContent(value: unknown): unknown {
  if (!Array.isArray(value)) return undefined;

  const parts: unknown[] = Array.from(value);
  const thinking = parts.find(isThinkingPart);

  return isJsonObject(thinking) ? thinking['signature'] : undefined;
}

function isThinkingPart(value: unknown): boolean {
  return isJsonObject(value) && value['type'] === 'thinking';
}
