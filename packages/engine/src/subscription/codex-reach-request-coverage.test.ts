import { describe, expect, test } from 'vitest';

import type { JsonObject } from '../gateway-wire';
import type { ParsedSubscriptionCredential } from './credentials';

import { isJsonObject } from '../gateway-wire';
import { codexReachRequest } from './codex-reach-request';
import { CodexReasoningReplay } from './codex-replay';

const credential: ParsedSubscriptionCredential = {
  accessToken: 'codex-access',
  accountId: 'acct-work',
  planType: 'pro',
};

type ReachOptions = Parameters<typeof codexReachRequest>[0];

function reachOptions(body: JsonObject, replay: CodexReasoningReplay | undefined): ReachOptions {
  return {
    providerOrigin: 'https://chatgpt.com/backend-api/codex',
    body,
    credential,
    replay,
    replayScopeId: 'claude:session-1',
    sessionId: 'session-1',
    sourceDialect: 'anthropic',
    responsesLite: false,
    requestId: 'request-1',
  };
}

function sentBody(serialized: string): JsonObject {
  const parsed: unknown = JSON.parse(serialized);

  return isJsonObject(parsed) ? parsed : {};
}

describe('the prompt cache key a Codex turn is reached with', () => {
  test('a turn naming a model is keyed apart from one naming another', () => {
    const first = codexReachRequest(reachOptions({ model: 'gpt-5', input: [] }, undefined));
    const second = codexReachRequest(reachOptions({ model: 'gpt-5-codex', input: [] }, undefined));

    expect(sentBody(first.body)['prompt_cache_key']).not.toBe(
      sentBody(second.body)['prompt_cache_key'],
    );
  });

  test('a turn that names no model falls back to the session key', () => {
    const request = codexReachRequest(reachOptions({ input: [] }, undefined));

    expect(sentBody(request.body)['prompt_cache_key']).toBe('session-1');
  });

  test('a turn whose model is not a name falls back to the session key', () => {
    const request = codexReachRequest(reachOptions({ model: 7, input: [] }, undefined));

    expect(sentBody(request.body)['prompt_cache_key']).toBe('session-1');
  });
});

describe('replaying reasoning into a Codex turn', () => {
  test('a turn reached without a replay store carries the input it arrived with', () => {
    const request = codexReachRequest(reachOptions({ model: 'gpt-5', input: [] }, undefined));

    expect(sentBody(request.body)['input']).toStrictEqual([]);
  });

  test('a replay store that holds nothing for the turn leaves the input alone', () => {
    const replay = new CodexReasoningReplay();
    const request = codexReachRequest(reachOptions({ model: 'gpt-5', input: [] }, replay));

    expect(sentBody(request.body)['input']).toStrictEqual([]);
  });

  test('a replayed turn whose model is not a name is keyed by the scope alone', () => {
    const replay = new CodexReasoningReplay();
    const request = codexReachRequest(reachOptions({ model: 7, input: [] }, replay));

    expect(sentBody(request.body)['input']).toStrictEqual([]);
    expect(sentBody(request.body)['prompt_cache_key']).toBe('session-1');
  });
});
