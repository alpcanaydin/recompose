import { describe, expect, test } from 'vitest';

import type { JsonObject, ProxyDialect } from '../gateway-wire';
import type { AntigravityReplayItem } from './antigravity-replay-items';
import type { ResolvedGrant } from './reach';

import { AntigravityReasoningReplay, antigravityReplayKey } from './antigravity-replay';
import { ClaudeDiagnostics } from './claude-diagnostics';
import { CodexReasoningReplay } from './codex-replay';
import { observeSubscriptionAnswer, subscriptionDiagnosticsKey } from './reach-observation';

type SubscriptionProvider = 'anthropic' | 'antigravity' | 'openai';
type ObservationScope = { sessionId: string; sourceDialect: ProxyDialect; replayScopeId: string };

function subscriptionGrant(provider: SubscriptionProvider, accountId = 'account-1'): ResolvedGrant {
  return {
    verdict: 'resolved',
    providerOrigin: 'https://example.test',
    spend: { custody: 'subscription', provider, accountId, credential: '{}' },
  };
}

function openGrant(): ResolvedGrant {
  return {
    verdict: 'resolved',
    providerOrigin: 'https://example.test',
    spend: { custody: 'open' },
  };
}

function recordedItem(): AntigravityReplayItem {
  return { id: 'call-1', name: 'read', args: { path: 'notes.md' } };
}

function jsonAnswer(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function anthropicScope(): ObservationScope {
  return { sessionId: 'session-1', sourceDialect: 'anthropic', replayScopeId: 'scope-1' };
}

describe('diagnostics are scoped to whoever pays for the turn', () => {
  test('two accounts sharing one session never share a diagnostics key', () => {
    const mine = subscriptionDiagnosticsKey(subscriptionGrant('anthropic'), 'session-1');
    const theirs = subscriptionDiagnosticsKey(
      subscriptionGrant('anthropic', 'account-2'),
      'session-1',
    );

    expect(mine).toContain('account-1');
    expect(mine).toContain('session-1');
    expect(mine).not.toBe(theirs);
  });

  test('a grant that names no account keys diagnostics by session alone', () => {
    expect(subscriptionDiagnosticsKey(openGrant(), 'session-1')).toBe('session-1');
  });
});

describe('an answer outside the observed paths is handed back as it came', () => {
  test('a Codex answer asked for in the Responses dialect is not observed', async () => {
    const answer = new Response('{}');

    const observed = await observeSubscriptionAnswer(
      subscriptionGrant('openai'),
      { model: 'gpt-5' },
      answer,
      { diagnostics: new ClaudeDiagnostics(), codexReplay: new CodexReasoningReplay() },
      { sessionId: 'session-1', sourceDialect: 'responses', replayScopeId: 'scope-1' },
    );

    expect(observed).toBe(answer);
  });

  test('an Antigravity answer for a model that never replays is not observed', async () => {
    const answer = new Response('{}');

    const observed = await observeSubscriptionAnswer(
      subscriptionGrant('antigravity'),
      { model: 'claude-sonnet-4-6' },
      answer,
      { diagnostics: new ClaudeDiagnostics(), antigravityReplay: new AntigravityReasoningReplay() },
      anthropicScope(),
    );

    expect(observed).toBe(answer);
  });
});

describe('a Codex answer is observed whatever the request named', () => {
  test('an answer for a request that names no model still reaches the caller', async () => {
    const observed = await observeSubscriptionAnswer(
      subscriptionGrant('openai'),
      {},
      jsonAnswer({ status: 'completed', output: [] }),
      { diagnostics: new ClaudeDiagnostics(), codexReplay: new CodexReasoningReplay() },
      anthropicScope(),
    );

    await expect(observed.json()).resolves.toHaveProperty('status', 'completed');
  });

  test('an answer refusing a thinking signature still reaches the caller', async () => {
    const refusal = { type: 'error', error: { message: 'invalid signature in thinking block' } };

    const observed = await observeSubscriptionAnswer(
      subscriptionGrant('openai'),
      { model: 'gpt-5' },
      jsonAnswer(refusal),
      { diagnostics: new ClaudeDiagnostics(), codexReplay: new CodexReasoningReplay() },
      anthropicScope(),
    );

    await expect(observed.json()).resolves.toHaveProperty(
      'error.message',
      'invalid signature in thinking block',
    );
  });
});

describe('an Antigravity refusal drops the reasoning recorded for that session', () => {
  test('a refused thought signature clears what the account had built', async () => {
    const antigravityReplay = new AntigravityReasoningReplay();
    const body: JsonObject = { model: 'gemini-3.6-flash' };
    const key = antigravityReplayKey('account-1', body, 'scope-1');

    antigravityReplay.commit(key, [recordedItem()]);

    expect(antigravityReplay.snapshot(key)).toHaveLength(1);

    const observed = await observeSubscriptionAnswer(
      subscriptionGrant('antigravity'),
      body,
      jsonAnswer({ error: 'invalid thoughtSignature' }, 400),
      { diagnostics: new ClaudeDiagnostics(), antigravityReplay },
      anthropicScope(),
    );

    expect(observed.status).toBe(400);
    expect(antigravityReplay.snapshot(key)).toEqual([]);
  });
});
