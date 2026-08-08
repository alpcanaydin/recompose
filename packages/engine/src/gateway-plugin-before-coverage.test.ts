import { describe, expect, it } from 'vitest';

import type { PluginClient } from './plugin-abi';

import { createGatewayApp } from './gateway-app';
import {
  aCredentialedGrant,
  aGatewayHolding,
  aVirtualModel,
  granting,
  neverFetches,
} from './gateway-app.testkit';
import { pluginMethods } from './plugin-abi';
import { PluginHost } from './plugin-host';

function encoded(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

async function hostRewritingBodyTo(body: string): Promise<PluginHost> {
  const client: PluginClient = {
    call: async (method) => {
      await Promise.resolve();

      if (method === pluginMethods.register) {
        return encoded({
          ok: true,
          result: {
            schema_version: 2,
            metadata: { name: 'rewriter' },
            capabilities: { request_interceptor: true },
          },
        });
      }

      return encoded({ ok: true, result: { Body: Buffer.from(body).toString('base64') } });
    },
    shutdown: () => undefined,
  };
  const host = new PluginHost(() => client);

  await host.load('rewriter', '/rewriter');

  return host;
}

async function askThrough(plugins: PluginHost) {
  const app = createGatewayApp(
    aGatewayHolding(aVirtualModel()),
    granting(aCredentialedGrant()).grantFor,
    neverFetches,
    undefined,
    undefined,
    undefined,
    plugins,
  );

  return app.request('http://127.0.0.1:8397/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify({ model: 'fast', messages: [{ role: 'user', content: 'hello' }] }),
  });
}

describe('a request plugin that rewrites the body into something that is not an object', () => {
  it('refuses the rewritten request instead of forwarding it', async () => {
    const answer = await askThrough(await hostRewritingBodyTo('["not","an","object"]'));

    expect(answer.status).toBe(400);
    await expect(answer.json()).resolves.toMatchObject({
      error: { message: 'A request plugin returned a body that is not a JSON object.' },
    });
  });
});
