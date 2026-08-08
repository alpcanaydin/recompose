import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import { createGatewayApp } from './gateway-app';
import { grantsNothing, neverFetches } from './gateway-app.testkit';

const codex = { slug: 'codex', displayName: 'Codex', port: 8397, virtualModels: [] };

const LOOPBACK_ADDRESSES = ['127.0.0.1', 'localhost', '[::1]'];

async function askCodexFrom(host: string, init?: RequestInit): Promise<Response> {
  return createGatewayApp(codex, grantsNothing, neverFetches).request(
    `http://${host}/health`,
    init,
  );
}

const hostArb = fc.oneof(
  fc.domain().map((domain) => `${domain}:${codex.port}`),
  fc
    .constantFrom(...LOOPBACK_ADDRESSES)
    .chain((address) => fc.integer({ min: 1024, max: 65535 }).map((port) => `${address}:${port}`)),
);

describe('who a gateway answers', () => {
  test.each(LOOPBACK_ADDRESSES)('a client at %s on the gateway port is served', async (address) => {
    const answer = await askCodexFrom(`${address}:${codex.port}`);

    expect(answer.status).toBe(200);
  });

  test('a client naming a host outside the loopback set is refused', async () => {
    const refusal = await askCodexFrom('gateway.example:8397');

    expect(refusal.status).toBe(403);
  });

  test.each(LOOPBACK_ADDRESSES)(
    'a client at %s naming a port this gateway never took is refused',
    async (address) => {
      const refusal = await askCodexFrom(`${address}:8398`);

      expect(refusal.status).toBe(403);
    },
  );

  test('the refusal explains itself in the Anthropic envelope', async () => {
    const refusal = await askCodexFrom('gateway.example:8397');

    expect(refusal.headers.get('content-type')).toContain('application/json');
    expect(await refusal.json()).toEqual({
      type: 'error',
      error: {
        type: 'permission_error',
        message: 'This gateway answers loopback clients only.',
      },
    });
  });

  test.prop([hostArb])(
    'a gateway serves the loopback names at its own port and nothing else',
    async (host) => {
      const answer = await askCodexFrom(host);
      const isItsOwnAddress = LOOPBACK_ADDRESSES.some(
        (address) => host === `${address}:${codex.port}`,
      );

      expect(answer.status).toBe(isItsOwnAddress ? 200 : 403);
    },
  );
});

describe('a browser page reaching a gateway', () => {
  test('a request carrying a foreign origin is refused even from loopback', async () => {
    const refusal = await askCodexFrom(`127.0.0.1:${codex.port}`, {
      headers: { origin: 'http://gateway.example' },
    });

    expect(refusal.status).toBe(403);
  });

  test('a request carrying the gateway address as its origin is refused too', async () => {
    const refusal = await askCodexFrom(`127.0.0.1:${codex.port}`, {
      headers: { origin: `http://127.0.0.1:${codex.port}` },
    });

    expect(refusal.status).toBe(403);
  });

  test('the refusal names the Origin header, not the address the client reached from', async () => {
    const refusal = await askCodexFrom(`127.0.0.1:${codex.port}`, {
      headers: { origin: 'http://gateway.example' },
    });

    expect(await refusal.json()).toEqual({
      type: 'error',
      error: {
        type: 'permission_error',
        message:
          'This gateway refuses any request that carries an Origin header, so no web page can reach it.',
      },
    });
  });
});
