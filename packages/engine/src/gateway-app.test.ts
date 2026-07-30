import { describe, expect, test } from 'vitest';

import { createGatewayApp } from './gateway-app';

const codex = { slug: 'codex', displayName: 'Codex', port: 8397 };

async function askCodex(path: string): Promise<Response> {
  return createGatewayApp(codex).request(`http://127.0.0.1:${codex.port}${path}`);
}

describe('the health path of a running gateway', () => {
  test('a health check answers with a success', async () => {
    const answer = await askCodex('/health');

    expect(answer.status).toBe(200);
  });

  test('the health answer carries the gateway name', async () => {
    const answer = await askCodex('/health');

    expect(await answer.json()).toEqual({ gateway: 'Codex' });
  });

  test('the health answer is JSON, so a machine check can read it', async () => {
    const answer = await askCodex('/health');

    expect(answer.headers.get('content-type')).toContain('application/json');
  });
});

describe('the address a person copies', () => {
  test('a gateway serves at the root of its address, under no name-shaped segment', async () => {
    const underItsOwnName = await askCodex('/codex/health');

    expect(underItsOwnName.status).toBe(404);
  });
});
