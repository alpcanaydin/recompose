import type { MiddlewareHandler } from 'hono';

import { nonLoopbackClient } from './refusals';

const LOOPBACK_ADDRESSES = ['127.0.0.1', 'localhost', '[::1]'];

export function guardLoopback(port: number): MiddlewareHandler {
  const ownAddresses = new Set(LOOPBACK_ADDRESSES.map((address) => `${address}:${port}`));

  return async (c, next) => {
    const carriesOrigin = c.req.header('origin') !== undefined;

    if (carriesOrigin || !ownAddresses.has(new URL(c.req.url).host)) {
      return c.json(nonLoopbackClient(), 403);
    }

    return next();
  };
}
