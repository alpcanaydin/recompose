import { expect, test } from 'vitest';

import type { AccountKind } from '../../../entities/account';

import { awaitedFor } from './awaited-providers';

const everyKind: readonly AccountKind[] = ['subscription', 'api-key', 'aggregator', 'local'];

test('the subscriptions nothing connects yet still stand in the catalog, named and explained', () => {
  expect(awaitedFor('subscription').map((awaited) => awaited.name)).toEqual([
    'GitHub Copilot',
    'Kimi Code',
    'GLM Coding Plan',
    'Qwen Coding Plan',
    'MiniMax Coding Plan',
  ]);

  for (const awaited of awaitedFor('subscription')) {
    expect(awaited.benefit.length).toBeGreaterThan(0);
  }
});

test('the local servers nothing runs yet stand beside the one that does', () => {
  expect(awaitedFor('local').map((awaited) => awaited.name)).toEqual([
    'LM Studio',
    'llama.cpp',
    'vLLM',
    'Custom local server',
  ]);
});

test('a local server waiting its turn is addressed the way a runtime is reached', () => {
  const lines = awaitedFor('local').map((awaited) => awaited.benefit);

  expect(lines.filter((line) => line.includes('localhost'))).toEqual([]);
  expect(lines).toContain('127.0.0.1:1234, local server');
  expect(lines).toContain('llama-server on 127.0.0.1:8080');
});

test('the runtime that connects today never stands under a Soon badge as well', () => {
  expect(awaitedFor('local').map((awaited) => awaited.name)).not.toContain('Ollama');
});

test('the key providers nothing connects yet stand in the catalog, each naming what it waits on', () => {
  expect(awaitedFor('api-key').map((awaited) => awaited.name)).toEqual([
    'Gemini API',
    'Mistral',
    'xAI Grok',
    'DeepSeek',
    'Moonshot AI',
    'Qwen',
    'Custom endpoint',
  ]);

  for (const awaited of awaitedFor('api-key')) {
    expect(awaited.benefit).toMatch(/Waits on/);
  }
});

test('the hosted catalogs nothing connects yet stand beside OpenRouter, each saying what it sells', () => {
  expect(awaitedFor('aggregator')).toEqual([
    { name: 'Together AI', benefit: 'Open-weights catalog', lead: { mark: 'together' } },
    { name: 'Fireworks AI', benefit: 'Fast open-model inference', lead: { mark: 'fireworks' } },
    { name: 'Groq', benefit: 'Lowest latency on its own silicon', lead: { mark: 'groq' } },
    { name: 'DeepInfra', benefit: 'Low-cost open-model catalog', lead: { mark: 'deepinfra' } },
    {
      name: 'Cerebras',
      benefit: 'Wafer-scale, fastest tokens per second',
      lead: { mark: 'cerebras' },
    },
    {
      name: 'Custom aggregator',
      benefit: 'Any hosted catalog behind one key',
      lead: { glyph: 'network' },
    },
  ]);
});

test('a category rather than a vendor leads with the shared glyph rather than a mark', () => {
  const categories = ['Custom endpoint', 'Custom aggregator', 'Custom local server'];
  const leads = everyKind.flatMap((kind) =>
    awaitedFor(kind).filter((awaited) => categories.includes(awaited.name)),
  );

  expect(leads.map((awaited) => awaited.lead)).toEqual([
    { glyph: 'network' },
    { glyph: 'network' },
    { glyph: 'network' },
  ]);
});

test('the one product publishing no mark leads with a glyph rather than borrowing another', () => {
  const llamaCpp = awaitedFor('local').find((awaited) => awaited.name === 'llama.cpp');

  expect(llamaCpp?.lead).toEqual({ glyph: 'monitor' });
});

test('every Soon row prints a line, and none of them prints the dash this project never writes', () => {
  const lines = everyKind.flatMap((kind) =>
    awaitedFor(kind).flatMap((awaited) => [awaited.name, awaited.benefit]),
  );

  expect(lines.filter((line) => line.length === 0)).toEqual([]);
  expect(lines.filter((line) => line.includes('—'))).toEqual([]);
});
