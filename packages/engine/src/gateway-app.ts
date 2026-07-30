import type { EngineGateway } from '@recompose/contracts';

import { Hono } from 'hono';

export function createGatewayApp(gateway: EngineGateway): Hono {
  const app = new Hono();

  app.get('/health', (c) => c.json({ gateway: gateway.displayName }));

  return app;
}
