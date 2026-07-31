import type { EngineGateway } from '@recompose/contracts';

import { Hono } from 'hono';

import { guardLoopback } from './loopback-guard';
import {
  missingModelInAnthropicDialect,
  missingModelInOpenAiDialect,
  unservedPath,
} from './refusals';

const ANTHROPIC_MODEL_PATHS = ['/v1/messages', '/messages'];
const OPENAI_MODEL_PATHS = ['/v1/chat/completions', '/chat/completions'];

export function createGatewayApp(gateway: EngineGateway): Hono {
  const app = new Hono();

  app.use(guardLoopback(gateway.port));

  app.get('/health', (c) => c.json({ gateway: gateway.displayName }));

  for (const path of ANTHROPIC_MODEL_PATHS) {
    app.all(path, (c) => c.json(missingModelInAnthropicDialect(gateway.displayName), 404));
  }

  for (const path of OPENAI_MODEL_PATHS) {
    app.all(path, (c) => c.json(missingModelInOpenAiDialect(gateway.displayName), 404));
  }

  app.notFound((c) => c.json(unservedPath(gateway.displayName, c.req.path), 404));

  return app;
}
