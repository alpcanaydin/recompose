import type { Account } from '@recompose/contracts';

import { expect, test } from 'vitest';

import { accountMark, accountName } from './target-identity';

const workKey: Account = {
  id: 'a1',
  provider: 'anthropic',
  kind: 'api-key',
  label: 'Work key',
  credentialRef: 'c-a1',
};

const runtime: Account = {
  id: 'a2',
  provider: 'ollama',
  kind: 'local',
  address: 'http://127.0.0.1:11434',
};

test('a stored key reads as the name the person filed it under', () => {
  expect(accountName(workKey)).toBe('Work key');
});

test('a stored runtime reads as the server it is, because nobody named it', () => {
  expect(accountName(runtime)).toBe('Ollama');
});

test('an account whose vendor recompose draws leads with that vendor mark', () => {
  expect(accountMark(workKey)).toBe('anthropic');
});

test('an account whose vendor recompose draws no mark for leads with nothing', () => {
  expect(accountMark({ ...workKey, provider: 'a-vendor-nobody-drew' })).toBeUndefined();
});
