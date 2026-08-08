import { describe, expect, test, vi } from 'vitest';

import type { JsonObject } from '../gateway-wire';
import type { ResolvedGrant } from './reach';

import { antigravityPairingError } from './antigravity-pairing';
import { AntigravityReasoningReplay, antigravityReplayKey } from './antigravity-replay';
import { toolResultBody } from './antigravity-replay.testkit';
import { reachSubscription, subscriptionRuntime } from './reach';

function content(...parts: JsonObject[]): JsonObject {
  return { role: 'user', parts };
}

function call(name = 'Bash', id = ''): JsonObject {
  return { functionCall: { id, name, args: {} } };
}

function response(name = 'Bash', id = ''): JsonObject {
  return { functionResponse: { id, name, response: {} } };
}

function body(...contents: JsonObject[]): JsonObject {
  return { model: 'gemini-3.6-flash-high', contents };
}

const invalidCases: [string, JsonObject, string][] = [
  ['interleaved calls and responses', body(content(call(), response())), 'interleaved'],
  [
    'a response across a user boundary',
    body(content(call()), content({ text: 'continue' }), content(response())),
    'content before pending',
  ],
  ['an orphan response', body(content(response())), 'without preceding'],
  ['a missing call name', body(content(call(''))), 'missing functionCall.name'],
  [
    'a new call before the pending response',
    body(content(call('Read')), content(call('Bash'))),
    'before pending',
  ],
  [
    'a response count mismatch',
    body(content(call('Read'), call('Bash')), content(response('Read'))),
    'count mismatch',
  ],
  [
    'a missing response id',
    body(content(call('Read', 'call-1')), content(response('Read'))),
    'missing functionResponse.id',
  ],
  [
    'a mismatched response id',
    body(content(call('Read', 'call-1')), content(response('Read', 'call-2'))),
    'id mismatch',
  ],
  [
    'a missing response name',
    body(content(call('Read')), content(response(''))),
    'missing functionResponse.name',
  ],
  [
    'a mismatched response name',
    body(content(call('Read')), content(response('Bash'))),
    'name mismatch',
  ],
];

describe('Gemini function call history pairing', () => {
  test('accepts parallel calls followed by ordered responses', () => {
    const value = body(
      content(call('Read', 'call-1'), call('Bash', 'call-2')),
      content(response('Read', 'call-1'), response('Bash', 'call-2')),
    );

    expect(antigravityPairingError(value)).toBeNull();
  });

  test('allows pending calls at the end of a request', () => {
    expect(antigravityPairingError(body(content(call('Read', 'call-1'))))).toBeNull();
  });

  test.each(invalidCases)('rejects %s', (_label, value, message) => {
    expect(antigravityPairingError(value)).toContain(message);
  });

  test('accepts a request that declares no contents list', () => {
    expect(antigravityPairingError({ model: 'gemini-3.6-flash-high' })).toBeNull();
  });

  test('ignores entries that carry no parts list', () => {
    const contents = ['plain', { role: 'model' }, { role: 'user', parts: 'text' }];

    expect(antigravityPairingError({ model: 'gemini-3.6-flash-high', contents })).toBeNull();
  });

  test('treats a call id or name of the wrong shape as absent', () => {
    const parts = [{ functionCall: { id: 7, name: 4, args: {} } }];

    expect(antigravityPairingError(body({ role: 'user', parts }))).toBe(
      'missing functionCall.name',
    );
  });
});

function grant(): ResolvedGrant {
  return {
    verdict: 'resolved',
    providerOrigin: 'https://daily-cloudcode-pa.googleapis.com',
    spend: {
      custody: 'subscription',
      provider: 'antigravity',
      accountId: 'account-1',
      credential: JSON.stringify({
        type: 'antigravity',
        access_token: 'access',
        refresh_token: 'refresh',
        expired: '2027-01-15T08:00:00.000Z',
        project_id: 'project-1',
      }),
    },
  };
}

test('transport rejects malformed client history without sending or clearing replay', async () => {
  const runtime = subscriptionRuntime();
  const replay = new AntigravityReasoningReplay();
  const malformed = body(
    content(call('Read')),
    content({ text: 'boundary' }),
    content(response('Read')),
  );
  const valid = toolResultBody();
  const key = antigravityReplayKey('account-1', valid, 'session-1');
  const send = vi.fn();

  replay.commit(key, [{ id: 'call-1', name: 'Bash', args: {} }]);
  runtime.antigravityReplay = replay;
  runtime.send = send;

  const answer = await reachSubscription(grant(), malformed, runtime, 'session-1');

  expect(answer.status).toBe(400);
  await expect(answer.json()).resolves.toHaveProperty('error.status', 'INVALID_ARGUMENT');
  expect(send).not.toHaveBeenCalled();
  expect(replay.inject(key, valid)).not.toBe(valid);
});

class PairBreakingReplay extends AntigravityReasoningReplay {
  readonly cleared: string[] = [];

  override inject(_key: string, _body: JsonObject): JsonObject {
    return body(content(response('Bash', 'call-1')));
  }

  override clear(key: string): void {
    this.cleared.push(key);
  }
}

test('transport clears replay when cache makes valid client history malformed', async () => {
  const runtime = subscriptionRuntime();
  const replay = new PairBreakingReplay();
  const valid = body(content({ text: 'hello' }));
  const send = vi.fn();

  runtime.antigravityReplay = replay;
  runtime.send = send;

  const answer = await reachSubscription(grant(), valid, runtime, 'session-1');

  expect(answer.status).toBe(400);
  expect(replay.cleared).toEqual([antigravityReplayKey('account-1', valid, 'session-1')]);
  expect(send).not.toHaveBeenCalled();
});
