import { describe, expect, test } from 'vitest';

import type { ProviderRequest } from './claude-request';
import type { SubscriptionWireFetch } from './provider-transport';

import { fetchClaudeProfile, sendSubscriptionRequest } from './provider-transport';

const DAILY_HOST = 'daily-cloudcode-pa.googleapis.com';
const STABLE_HOST = 'cloudcode-pa.googleapis.com';

function requestTo(url: string): ProviderRequest {
  return { url, headers: [['Content-Type', 'application/json']], body: '{}' };
}

function streamOf(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

function hostEchoFetch(): SubscriptionWireFetch {
  return async (url) => {
    await Promise.resolve();
    const hostname = new URL(url).hostname;

    return {
      status: hostname === DAILY_HOST ? 429 : 200,
      headers: [['x-reached-host', hostname]],
      body: streamOf('{"ok":true}'),
    };
  };
}

function refusingDailyFetch(): SubscriptionWireFetch {
  return async (url) => {
    await Promise.resolve();
    const hostname = new URL(url).hostname;

    if (hostname === DAILY_HOST) throw new Error('socket closed');

    return { status: 200, headers: [['x-reached-host', hostname]], body: streamOf('{"ok":true}') };
  };
}

function unreachableFetch(): SubscriptionWireFetch {
  return async () => {
    await Promise.resolve();

    throw new Error('socket closed');
  };
}

function profileFetch(status: number, payload: string): SubscriptionWireFetch {
  return async () => {
    await Promise.resolve();

    return {
      status,
      statusText: 'OK',
      headers: [['content-type', 'application/json']],
      body: streamOf(payload),
    };
  };
}

function emptyUpstream(): SubscriptionWireFetch {
  return async () => {
    await Promise.resolve();

    return { status: 204, headers: [['x-origin', 'openai']], body: null };
  };
}

describe('subscription request delivery', () => {
  test('a provider that needs no unwrapping answers with the upstream response', async () => {
    const response = await sendSubscriptionRequest(
      'openai',
      requestTo('https://chatgpt.com/backend-api/codex/responses'),
      emptyUpstream(),
    );

    expect(response.status).toBe(204);
    expect(response.statusText).toBe('');
    expect(response.headers.get('x-origin')).toBe('openai');
  });

  test('an Antigravity request throttled on the daily host retries the stable host', async () => {
    const response = await sendSubscriptionRequest(
      'antigravity',
      requestTo(`https://${DAILY_HOST}/v1internal:generateContent`),
      hostEchoFetch(),
    );

    expect(response.headers.get('x-reached-host')).toBe(STABLE_HOST);
  });

  test('an Antigravity request already on the stable host has nowhere to retry', async () => {
    const response = await sendSubscriptionRequest(
      'antigravity',
      requestTo(`https://${STABLE_HOST}/v1internal:generateContent`),
      hostEchoFetch(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('x-reached-host')).toBe(STABLE_HOST);
  });

  test('an Antigravity connection failure on the daily host retries the stable host', async () => {
    const response = await sendSubscriptionRequest(
      'antigravity',
      requestTo(`https://${DAILY_HOST}/v1internal:generateContent`),
      refusingDailyFetch(),
    );

    expect(response.headers.get('x-reached-host')).toBe(STABLE_HOST);
  });

  test('an Antigravity connection failure with nowhere to retry surfaces the failure', async () => {
    await expect(
      sendSubscriptionRequest(
        'antigravity',
        requestTo(`https://${STABLE_HOST}/v1internal:generateContent`),
        unreachableFetch(),
      ),
    ).rejects.toThrow('socket closed');
  });
});

describe('Claude OAuth profile', () => {
  test('a profile carrying an account identifier is returned', async () => {
    const profile = await fetchClaudeProfile(
      'token-1',
      profileFetch(200, '{"account":{"uuid":"5b2c-uuid"}}'),
    );

    expect(profile).toEqual({ account: { uuid: '5b2c-uuid' } });
  });

  test('a rejected profile request reports the upstream status', async () => {
    await expect(fetchClaudeProfile('token-1', profileFetch(401, '{}'))).rejects.toThrow(
      'status 401',
    );
  });

  test('a profile without a usable account identifier is refused', async () => {
    const payloads = ['"text"', '{"account":"none"}', '{"account":{"uuid":"   "}}', '{}'];

    for (const payload of payloads) {
      await expect(fetchClaudeProfile('token-1', profileFetch(200, payload))).rejects.toThrow(
        'account UUID is empty',
      );
    }
  });
});
