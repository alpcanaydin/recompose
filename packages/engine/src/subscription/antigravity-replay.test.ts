import { describe, expect, test } from 'vitest';

import type { ResolvedGrant } from './reach';

import { parsedJson } from '../gateway-wire';
import {
  AntigravityReasoningReplay,
  antigravityReplayKey,
  observeAntigravityReasoning,
} from './antigravity-replay';
import { reachSubscription, subscriptionRuntime } from './reach';

function nativeSignature(): string {
  const payload = Buffer.from([0x01, 0x0c, 0x39]);
  const inner = Buffer.concat([Buffer.from([0x0a, payload.length]), payload]);

  return Buffer.concat([Buffer.from([0x12, inner.length]), inner]).toString('base64');
}

function responseOf(parts: unknown[], finishReason: string | null = 'STOP') {
  return {
    candidates: [
      {
        content: { role: 'model', parts },
        ...(finishReason === null ? {} : { finishReason }),
      },
    ],
  };
}

function toolResultBody(model = 'gemini-3.6-flash-high') {
  return {
    model,
    contents: [
      { role: 'user', parts: [{ text: 'run it' }] },
      {
        role: 'user',
        parts: [{ functionResponse: { id: 'call-1', name: 'Bash', response: { ok: true } } }],
      },
    ],
  };
}

describe('Antigravity reasoning replay cache', () => {
  test('injects a cached native tool call before its compacted function response', () => {
    const replay = new AntigravityReasoningReplay();
    const body = toolResultBody();
    const key = antigravityReplayKey('account-1', body, 'session-1');
    const signature = nativeSignature();

    replay.commit(key, [{ id: 'call-1', name: 'Bash', args: { command: 'true' }, signature }]);
    const injected = replay.inject(key, body);

    expect(injected).toHaveProperty('contents.1.role', 'model');
    expect(injected).toHaveProperty('contents.1.parts.0.functionCall.id', 'call-1');
    expect(injected).toHaveProperty('contents.1.parts.0.functionCall.args.command', 'true');
    expect(injected).toHaveProperty('contents.1.parts.0.thoughtSignature', signature);
    expect(injected).toHaveProperty('contents.2.parts.0.functionResponse.id', 'call-1');
  });

  test('keeps account, model, and session scopes separate', () => {
    const replay = new AntigravityReasoningReplay();
    const body = toolResultBody();
    const key = antigravityReplayKey('account-1', body, 'session-1');

    replay.commit(key, [{ id: 'call-1', name: 'Bash', args: {} }]);

    expect(replay.inject(antigravityReplayKey('account-2', body, 'session-1'), body)).toBe(body);
    expect(replay.inject(antigravityReplayKey('account-1', body, 'session-2'), body)).toBe(body);
    expect(
      replay.inject(
        antigravityReplayKey('account-1', toolResultBody('gemini-pro'), 'session-1'),
        body,
      ),
    ).toBe(body);
  });

  test('restores a missing signature onto an unchanged existing function call', () => {
    const replay = new AntigravityReasoningReplay();
    const body = {
      model: 'gemini-3.6-flash-high',
      contents: [
        {
          role: 'model',
          parts: [{ functionCall: { id: 'call-1', name: 'Bash', args: { command: 'true' } } }],
        },
      ],
    };
    const key = antigravityReplayKey('account-1', body, 'session-1');
    const signature = nativeSignature();

    replay.commit(key, [{ id: 'call-1', name: 'Bash', args: { command: 'true' }, signature }]);

    expect(replay.inject(key, body)).toHaveProperty(
      'contents.0.parts.0.thoughtSignature',
      signature,
    );
  });
});

describe('observing complete Antigravity reasoning chains', () => {
  test('learns a directly signed function call from a non-stream response', async () => {
    const replay = new AntigravityReasoningReplay();
    const body = toolResultBody();
    const key = antigravityReplayKey('account-1', body, 'session-1');
    const signature = nativeSignature();
    const response = Response.json(
      responseOf([
        {
          functionCall: { id: 'call-1', name: 'Bash', args: { command: 'true' } },
          thoughtSignature: signature,
        },
      ]),
    );

    await observeAntigravityReasoning(
      response,
      (items) => {
        replay.commit(key, items);
      },
      () => {
        replay.clear(key);
      },
    );

    expect(replay.inject(key, body)).toHaveProperty(
      'contents.1.parts.0.thoughtSignature',
      signature,
    );
  });
});

describe('associating Antigravity signature carriers', () => {
  test('associates a detached signature carrier with the following function call', async () => {
    const replay = new AntigravityReasoningReplay();
    const body = toolResultBody();
    const key = antigravityReplayKey('account-1', body, 'session-1');
    const signature = nativeSignature();
    const response = Response.json(
      responseOf([
        { text: '', thought: true, thoughtSignature: signature },
        { functionCall: { id: 'call-1', name: 'Bash', args: {} } },
      ]),
    );

    await observeAntigravityReasoning(
      response,
      (items) => {
        replay.commit(key, items);
      },
      () => {},
    );

    expect(replay.inject(key, body)).toHaveProperty(
      'contents.1.parts.0.thoughtSignature',
      signature,
    );
  });
});

describe('observing streamed Antigravity reasoning chains', () => {
  test('accumulates tool chunks and commits only after a terminal chunk', async () => {
    const replay = new AntigravityReasoningReplay();
    const body = toolResultBody();
    const key = antigravityReplayKey('account-1', body, 'session-1');
    const signature = nativeSignature();
    const chunks = [
      responseOf([{ functionCall: { id: 'call-1', name: 'Bash', args: {} } }], null),
      responseOf([
        { functionCall: { id: 'call-1', name: 'Bash', args: {} }, thoughtSignature: signature },
      ]),
    ];
    const stream = chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('');
    const response = new Response(stream, { headers: { 'content-type': 'text/event-stream' } });
    const observed = await observeAntigravityReasoning(
      response,
      (items) => {
        replay.commit(key, items);
      },
      () => {
        replay.clear(key);
      },
    );

    await observed.text();

    expect(replay.inject(key, body)).toHaveProperty(
      'contents.1.parts.0.thoughtSignature',
      signature,
    );
  });

  test('does not commit a partial stream without a finish reason', async () => {
    const replay = new AntigravityReasoningReplay();
    const body = toolResultBody();
    const key = antigravityReplayKey('account-1', body, 'session-1');
    const chunk = responseOf([{ functionCall: { id: 'call-1', name: 'Bash', args: {} } }], null);
    const response = new Response(`data: ${JSON.stringify(chunk)}\n\n`, {
      headers: { 'content-type': 'text/event-stream' },
    });
    const observed = await observeAntigravityReasoning(
      response,
      (items) => {
        replay.commit(key, items);
      },
      () => {
        replay.clear(key);
      },
    );

    await observed.text();

    expect(replay.inject(key, body)).toBe(body);
  });
});

test('a signature-related 400 clears only the active replay scope', async () => {
  const replay = new AntigravityReasoningReplay();
  const body = toolResultBody();
  const first = antigravityReplayKey('account-1', body, 'session-1');
  const second = antigravityReplayKey('account-1', body, 'session-2');
  const item = { id: 'call-1', name: 'Bash', args: {} };

  replay.commit(first, [item]);
  replay.commit(second, [item]);
  await observeAntigravityReasoning(
    new Response('{"error":"invalid thoughtSignature"}', { status: 400 }),
    () => {},
    () => {
      replay.clear(first);
    },
  );

  expect(replay.inject(first, body)).toBe(body);
  expect(replay.inject(second, body)).not.toBe(body);
});

test('subscription transport replays a learned tool call on the next request', async () => {
  const sent: string[] = [];
  const signature = nativeSignature();
  const runtime = subscriptionRuntime();

  runtime.send = async (_provider, request) => {
    sent.push(request.body);
    await Promise.resolve();

    return Response.json(
      responseOf([
        {
          functionCall: { id: 'call-1', name: 'Bash', args: { command: 'true' } },
          thoughtSignature: signature,
        },
      ]),
    );
  };

  const grant: ResolvedGrant = {
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
  const first = { model: 'gemini-3.6-flash-high', contents: [{ role: 'user', parts: [] }] };

  await reachSubscription(grant, first, runtime, 'session-1', 'anthropic');
  await reachSubscription(grant, toolResultBody(), runtime, 'session-1', 'anthropic');

  expect(parsedJson(sent[1] ?? '{}')).toHaveProperty(
    'request.contents.1.parts.0.functionCall.id',
    'call-1',
  );
});
