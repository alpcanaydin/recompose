import { describe, expect, test } from 'vitest';

import { createGatewayApp } from './gateway-app';
import { aGatewayHolding, aVirtualModel, granting, neverFetches } from './gateway-app.testkit';
import { codexSse } from './gateway-proxy-codex-subscription.testkit';
import {
  codexCredential,
  runtimeAnswering,
  subscriptionGrant,
} from './gateway-proxy-subscription.testkit';
import { isJsonObject, parsedJson } from './gateway-wire';

function payload(model: string) {
  return {
    model,
    input: [
      {
        type: 'additional_tools',
        role: 'developer',
        tools: [
          {
            type: 'namespace',
            name: 'collaboration',
            tools: [
              {
                type: 'function',
                name: 'spawn_agent',
                description:
                  'Available model overrides (optional; inherited parent model is preferred):\n- old-model\nSpawns an agent.',
                parameters: {
                  type: 'object',
                  properties: { message: { type: 'string', encrypted: true } },
                },
              },
            ],
          },
        ],
      },
      {
        type: 'agent_message',
        author: '/root',
        recipient: '/root/worker',
        content: [{ type: 'encrypted_content', encrypted_content: 'delegated task' }],
      },
    ],
  };
}

function appFixture() {
  const model = aVirtualModel({ target: { standing: 'bound', providerModel: 'gpt-5.4' } });
  const grants = granting(subscriptionGrant('openai', codexCredential()));
  let provider: ReturnType<typeof runtimeAnswering> | undefined;

  provider = runtimeAnswering(() => optimizedAnswer(provider));
  const app = createGatewayApp(
    aGatewayHolding(model),
    grants.grantFor,
    neverFetches,
    provider.runtime,
  );

  return { app, model, provider };
}

function optimizedOutput() {
  return [{ type: 'function_call', name: 'spawn_agent', namespace: 'collaboration-optimize' }];
}

function optimizedAnswer(provider: ReturnType<typeof runtimeAnswering> | undefined): Response {
  const compact = provider?.sent.at(-1)?.request.url.endsWith('/compact') === true;

  return compact
    ? Response.json({ id: 'resp_1', object: 'response.compaction', output: optimizedOutput() })
    : codexSse([
        {
          type: 'response.completed',
          response: { id: 'resp_1', status: 'completed', output: optimizedOutput() },
        },
      ]);
}

function optimizedBody(provider: ReturnType<typeof appFixture>['provider']) {
  const value = parsedJson(provider.sent.at(-1)?.request.body ?? '');

  return isJsonObject(value) ? value : {};
}

async function requestMode(
  fixture: ReturnType<typeof appFixture>,
  mode: 'execute' | 'stream' | 'compact',
): Promise<Response> {
  const compact = mode === 'compact';
  const path = compact ? '/v1/responses/compact' : '/v1/responses';
  const body = { ...payload(fixture.model.id), ...(mode === 'stream' ? { stream: true } : {}) };

  return Promise.resolve(
    fixture.app.request(`http://127.0.0.1:8397${path}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  );
}

async function expectRestored(answer: Response, mode: 'execute' | 'stream' | 'compact') {
  if (mode === 'stream') {
    expect(await answer.text()).toContain('"namespace":"collaboration"');

    return;
  }

  await expect(answer.json()).resolves.toHaveProperty('output.0.namespace', 'collaboration');
}

describe('Codex spawn-agent optimization parity', () => {
  test('TestCodexExecutorOptimizeMultiAgentV2', async () => {
    const fixture = appFixture();

    for (const mode of ['execute', 'stream', 'compact'] as const) {
      const answer = await requestMode(fixture, mode);
      const body = optimizedBody(fixture.provider);

      expect(body).toHaveProperty('input.0.tools.0.name', 'collaboration-optimize');
      expect(body).not.toHaveProperty(
        'input.0.tools.0.tools.0.parameters.properties.message.encrypted',
      );
      expect(body).toHaveProperty('input.1.type', 'agent_message');
      expect(body).toHaveProperty('input.1.content.0.type', 'input_text');
      expect(body).toHaveProperty('input.1.content.0.text', 'delegated task');
      expect(body).not.toHaveProperty('input.1.content.0.encrypted_content');
      expect(body).toHaveProperty(
        'input.0.tools.0.tools.0.description',
        expect.stringContaining('`gpt-5.4`'),
      );
      await expectRestored(answer, mode);
    }
  });
});
