import type { CredentialedAccount, LocalAccount } from '@recompose/contracts';

import { describe, expect, test } from 'vitest';

import { providerOriginOf } from './provider-origin';

function keyRow(
  provider: string,
  kind: CredentialedAccount['kind'] = 'api-key',
): CredentialedAccount {
  return { id: 'acc-key', provider, kind, label: 'build', credentialRef: 'cred-1' };
}

const ollama: LocalAccount = {
  id: 'acc-here',
  provider: 'ollama',
  kind: 'local',
  address: 'http://127.0.0.1:11434',
};

describe('the origin a target account is spent against', () => {
  test('a local runtime is spent against the address its account was stored with', () => {
    expect(providerOriginOf(ollama)).toBe('http://127.0.0.1:11434');
  });

  test('a local runtime kept off the documented port is spent against the port it holds', () => {
    expect(providerOriginOf({ ...ollama, address: 'http://127.0.0.1:31434' })).toBe(
      'http://127.0.0.1:31434',
    );
  });

  test('an Anthropic key is spent against the Anthropic serving endpoint', () => {
    expect(providerOriginOf(keyRow('anthropic'))).toBe('https://api.anthropic.com');
  });

  test('an OpenAI key is spent against the OpenAI serving endpoint', () => {
    expect(providerOriginOf(keyRow('openai'))).toBe('https://api.openai.com');
  });

  test('an OpenRouter key is spent against the aggregator serving base', () => {
    expect(providerOriginOf(keyRow('openrouter', 'aggregator'))).toBe('https://openrouter.ai/api');
  });

  test('a key under a provider recompose serves nothing for is spent against nothing', () => {
    expect(providerOriginOf(keyRow('cerebras'))).toBeUndefined();
  });
});

describe('a provider named after something every object carries', () => {
  test('a key stored under the provider "constructor" is spent against nothing', () => {
    expect(providerOriginOf(keyRow('constructor'))).toBeUndefined();
  });

  test('a key stored under the provider "toString" is spent against nothing', () => {
    expect(providerOriginOf(keyRow('toString'))).toBeUndefined();
  });

  test('a key stored under the provider "valueOf" is spent against nothing', () => {
    expect(providerOriginOf(keyRow('valueOf'))).toBeUndefined();
  });

  test('a key stored under the provider "__proto__" is spent against nothing', () => {
    expect(providerOriginOf(keyRow('__proto__'))).toBeUndefined();
  });
});
