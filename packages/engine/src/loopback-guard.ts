import type { MiddlewareHandler } from 'hono';

import { nonLoopbackClient, requestCarriesOrigin } from './refusals';

const LOOPBACK_ADDRESSES = ['127.0.0.1', 'localhost', '[::1]'];

export function guardLoopback(port: number): MiddlewareHandler {
  const ownAddresses = new Set(LOOPBACK_ADDRESSES.map((address) => `${address}:${port}`));

  return async (c, next) => {
    if (!ownAddresses.has(new URL(c.req.url).host)) {
      return c.json(nonLoopbackClient(), 403);
    }

    if (c.req.header('origin') !== undefined) {
      return c.json(requestCarriesOrigin(), 403);
    }

    return next();
  };
}
