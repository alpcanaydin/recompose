import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { openGatewayListeners } from './gateway-listener';

const PRIVILEGED_PORT = 1;

describe('opening a gateway on a port the machine will not hand over', () => {
  it('reports the port it could not take', async () => {
    const app = new Hono();

    await expect(openGatewayListeners(app, PRIVILEGED_PORT)).resolves.toEqual({
      failed: { port: PRIVILEGED_PORT },
    });
  });
});
