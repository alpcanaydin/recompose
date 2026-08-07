import type { CredentialedAccount, LocalAccount, SubscriptionAccount } from '@recompose/contracts';

import { afterEach, describe, expect, test, vi } from 'vitest';

import { providerOriginOf } from './provider-origin';

const SERVING_ORIGIN = 'RECOMPOSE_SERVING_ORIGIN';

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

function subscription(provider: SubscriptionAccount['provider']): SubscriptionAccount {
  return { id: `acc-${provider}`, provider, kind: 'subscription', label: provider };
}

describe('the origin a target account is spent against', () => {
  test('an AI Studio channel targets the Gemini API endpoint', () => {
    expect(providerOriginOf(keyRow('aistudio'))).toBe('https://generativelanguage.googleapis.com');
  });

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

  test('a Gemini key is spent against the Generative Language endpoint', () => {
    expect(providerOriginOf(keyRow('gemini'))).toBe('https://generativelanguage.googleapis.com');
  });

  test('a Kimi credential is spent against the Coding API', () => {
    expect(providerOriginOf(keyRow('kimi'))).toBe('https://api.kimi.com/coding');
  });

  test('an xAI credential is spent against the official API', () => {
    expect(providerOriginOf(keyRow('xai'))).toBe('https://api.x.ai/v1');
  });

  test('a Vertex credential is spent against the AI Platform endpoint', () => {
    expect(providerOriginOf(keyRow('vertex'))).toBe('https://aiplatform.googleapis.com');
  });

  test('an OpenRouter key is spent against the aggregator serving base', () => {
    expect(providerOriginOf(keyRow('openrouter', 'aggregator'))).toBe('https://openrouter.ai/api');
  });

  test('a Claude subscription is spent against the Claude Messages origin', () => {
    expect(providerOriginOf(subscription('anthropic'))).toBe('https://api.anthropic.com');
  });

  test('a Codex subscription is spent against the ChatGPT Codex origin', () => {
    expect(providerOriginOf(subscription('openai'))).toBe('https://chatgpt.com/backend-api/codex');
  });

  test('an Antigravity subscription is spent against Cloud Code Assist', () => {
    expect(providerOriginOf(subscription('antigravity'))).toBe(
      'https://daily-cloudcode-pa.googleapis.com',
    );
  });

  test('a key under a provider recompose serves nothing for is spent against nothing', () => {
    expect(providerOriginOf(keyRow('cerebras'))).toBeUndefined();
  });
});

describe('an origin the environment names in place of the vendor endpoint', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('a loopback origin stands in for the vendor a first-party key is spent against', () => {
    vi.stubEnv(SERVING_ORIGIN, 'http://127.0.0.1:41999');

    expect(providerOriginOf(keyRow('anthropic'))).toBe('http://127.0.0.1:41999');
  });

  test('a loopback origin stands in for the aggregator serving base too', () => {
    vi.stubEnv(SERVING_ORIGIN, 'http://localhost:41999');

    expect(providerOriginOf(keyRow('openrouter', 'aggregator'))).toBe('http://localhost:41999');
  });

  test('an origin naming a host off this machine is refused, and the vendor stands', () => {
    vi.stubEnv(SERVING_ORIGIN, 'https://origin.example.com');

    expect(providerOriginOf(keyRow('anthropic'))).toBe('https://api.anthropic.com');
  });

  test('an origin that is no URL at all is refused the same way', () => {
    vi.stubEnv(SERVING_ORIGIN, 'not-an-origin');

    expect(providerOriginOf(keyRow('openai'))).toBe('https://api.openai.com');
  });

  test('a provider recompose serves nothing for stays spent against nothing', () => {
    vi.stubEnv(SERVING_ORIGIN, 'http://127.0.0.1:41999');

    expect(providerOriginOf(keyRow('cerebras'))).toBeUndefined();
  });

  test('a local runtime is still spent against the address its account was stored with', () => {
    vi.stubEnv(SERVING_ORIGIN, 'http://127.0.0.1:41999');

    expect(providerOriginOf(ollama)).toBe('http://127.0.0.1:11434');
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
