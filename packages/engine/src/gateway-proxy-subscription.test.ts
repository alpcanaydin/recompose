import { describe, expect, test, vi } from 'vitest';

import type { ProviderRequest } from './subscription/claude-request';

import { createGatewayApp } from './gateway-app';
import { aGatewayHolding, granting, neverFetches } from './gateway-app.testkit';
import {
  chatRequest,
  claudeAnswer,
  claudeCredential,
  runtimeAnswering,
  subscriptionGrant,
  subscriptionModel,
} from './gateway-proxy-subscription.testkit';
import { isJsonObject } from './gateway-wire';
import { ClaudeDiagnostics } from './subscription/claude-diagnostics';

function claudeApp(credential: string, runtime: Parameters<typeof createGatewayApp>[3]) {
  const grants = granting(subscriptionGrant('anthropic', credential));

  return createGatewayApp(
    aGatewayHolding(subscriptionModel),
    grants.grantFor,
    neverFetches,
    runtime,
  );
}

function metadataFromRequest(body: string | undefined): Record<string, unknown> {
  const parsed: unknown = JSON.parse(body ?? '{}');
  const metadata = isJsonObject(parsed) ? parsed['metadata'] : undefined;

  if (!isJsonObject(metadata)) {
    throw new Error('expected Claude request metadata');
  }

  return metadata;
}

function orderedRefreshRuntime(order: string[]) {
  const refreshFetch = vi.fn(async () => {
    await Promise.resolve();
    order.push('refresh');

    return Response.json({ access_token: 'new-access', expires_in: 28_800 });
  });
  const persist = vi.fn(async () => {
    await Promise.resolve();
    order.push('persist');
  });
  const send = vi.fn(async (_provider: string, request: ProviderRequest) => {
    await Promise.resolve();
    order.push('send');
    expect(request.headers).toContainEqual(['Authorization', 'Bearer new-access']);

    return claudeAnswer();
  });

  return {
    persist,
    runtime: {
      send,
      refreshFetch,
      persist,
      now: () => 1_700_000_000_000,
      randomUUID: () => '11111111-1111-4111-8111-111111111111',
      newClaudeDeviceId: () => '0'.repeat(64),
      fetchClaudeProfile: async () => {
        await Promise.resolve();

        return { account: { uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } };
      },
      diagnostics: new ClaudeDiagnostics(),
    },
  };
}

describe('serving a Claude subscription target', () => {
  test('a malformed provider credential is refused before any network request', async () => {
    const provider = runtimeAnswering(() => Response.json({}));
    const app = claudeApp('{"claudeAiOauth":null}', provider.runtime);
    const answer = await chatRequest(app);

    expect(answer.status).toBe(502);
    expect(await answer.json()).toMatchObject({ error: { code: 'missing_credential' } });
    expect(provider.sent).toEqual([]);
  });

  test('a Chat Completions request crosses to Messages and its answer crosses back', async () => {
    const provider = runtimeAnswering(() => claudeAnswer([{ type: 'text', text: 'hello back' }]));
    const app = claudeApp(claudeCredential('claude-access', 1_800_000_000_000), provider.runtime);
    const answer = await chatRequest(app);

    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0]?.provider).toBe('anthropic');
    const sentBody: unknown = JSON.parse(provider.sent[0]?.request.body ?? '{}');

    expect(sentBody).toHaveProperty('model', 'claude-sonnet-4-5');
    expect(sentBody).toHaveProperty('messages.0.content.1', {
      type: 'text',
      text: 'hello',
      cache_control: { type: 'ephemeral' },
    });
    expect(await answer.json()).toMatchObject({
      choices: [{ message: { role: 'assistant', content: 'hello back' } }],
    });
    expect(provider.persist).not.toHaveBeenCalled();
  });

  test('a Responses stream exposes the requested virtual model', async () => {
    const provider = runtimeAnswering(() => claudeStreamAnswer());
    const app = claudeApp(claudeCredential('claude-access', 1_800_000_000_000), provider.runtime);
    const answer = await app.request('http://127.0.0.1:8397/v1/responses', {
      method: 'POST',
      body: JSON.stringify({
        model: 'fast',
        stream: true,
        input: [{ type: 'message', role: 'user', content: 'hello' }],
      }),
    });
    const events = ssePayloads(await answer.text());

    expect(events.find((event) => event['type'] === 'response.created')).toHaveProperty(
      'response.model',
      'fast',
    );
    expect(events.find((event) => event['type'] === 'response.completed')).toHaveProperty(
      'response.model',
      'fast',
    );
  });
});

function claudeStreamAnswer(): Response {
  const events = [
    {
      type: 'message_start',
      message: {
        id: 'msg_1',
        model: 'claude-sonnet-4-5',
        type: 'message',
        role: 'assistant',
        content: [],
        stop_reason: null,
        usage: { input_tokens: 1, output_tokens: 0 },
      },
    },
    { type: 'message_stop' },
  ];

  return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''), {
    headers: { 'content-type': 'text/event-stream' },
  });
}

function ssePayloads(text: string): Record<string, unknown>[] {
  return text
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line): unknown => JSON.parse(line.slice(6)))
    .filter(isJsonObject);
}

describe('preparing a Claude subscription identity', () => {
  test('a missing Claude identity is fetched, persisted, and sent upstream', async () => {
    const provider = runtimeAnswering(() => claudeAnswer());
    const credential = JSON.stringify({
      claudeAiOauth: { accessToken: 'claude-access', expiresAt: 1_800_000_000_000 },
    });
    const app = claudeApp(credential, provider.runtime);
    const answer = await chatRequest(app);
    const metadata = metadataFromRequest(provider.sent[0]?.request.body);

    expect(answer.status).toBe(200);
    expect(provider.persist).toHaveBeenCalledWith(
      'anthropic',
      'acc-anthropic',
      expect.stringContaining('claude_device_ids'),
    );
    expect(JSON.parse(String(metadata['user_id']))).toEqual({
      device_id: '0'.repeat(64),
      account_uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      session_id: '11111111-1111-4111-8111-111111111111',
    });
  });
});

describe('tracking Claude subscription continuity', () => {
  test('successful turns advance Claude diagnostics within one downstream session', async () => {
    const provider = runtimeAnswering(() => claudeAnswer());
    const app = claudeApp(claudeCredential('claude-access', 1_800_000_000_000), provider.runtime);

    await chatRequest(app, false, 'conversation-1');
    await chatRequest(app, false, 'conversation-1');

    const bodies: unknown[] = provider.sent.map(({ request }) => {
      const parsed: unknown = JSON.parse(request.body);

      return parsed;
    });
    const headers = provider.sent.flatMap(({ request }) => request.headers);

    expect(bodies).toEqual([
      expect.objectContaining({ diagnostics: { previous_message_id: null } }),
      expect.objectContaining({ diagnostics: { previous_message_id: 'msg_1' } }),
    ]);
    expect(headers).toContainEqual(['X-Claude-Code-Session-Id', 'conversation-1']);
  });
});

describe('rotating a Claude subscription credential', () => {
  test('an expired token is persisted before the provider request is sent', async () => {
    const order: string[] = [];
    const ordered = orderedRefreshRuntime(order);
    const app = claudeApp(claudeCredential('old-access', 1_600_000_000_000), ordered.runtime);
    const answer = await chatRequest(app);

    expect(answer.status).toBe(200);
    expect(order).toEqual(['refresh', 'persist', 'send']);
    expect(ordered.persist).toHaveBeenCalledWith(
      'anthropic',
      'acc-anthropic',
      expect.stringContaining('new-access'),
    );
  });

  test('one unauthorized answer refreshes and retries once', async () => {
    const refreshFetch = vi.fn(async () => {
      await Promise.resolve();

      return Response.json({ access_token: 'new-access', expires_in: 28_800 });
    });
    const persist = vi.fn(async () => {
      await Promise.resolve();
    });
    const send = vi.fn(async () => {
      await Promise.resolve();

      return claudeAnswer();
    });

    send.mockResolvedValueOnce(Response.json({ error: 'expired' }, { status: 401 }));

    const app = claudeApp(claudeCredential('old-access', 1_800_000_000_000), {
      send,
      refreshFetch,
      persist,
      now: () => 1_700_000_000_000,
      randomUUID: () => '11111111-1111-4111-8111-111111111111',
      newClaudeDeviceId: () => '0'.repeat(64),
      fetchClaudeProfile: async () => {
        await Promise.resolve();

        return { account: { uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } };
      },
      diagnostics: new ClaudeDiagnostics(),
    });
    const answer = await chatRequest(app);

    expect(answer.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(2);
    expect(refreshFetch).toHaveBeenCalledOnce();
    expect(persist).toHaveBeenCalledOnce();
  });
});
