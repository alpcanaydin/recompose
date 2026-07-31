import type { AddressInfo } from 'node:net';

export function portFromAddress(bound: AddressInfo | string | null): number {
  if (bound === null || typeof bound === 'string') {
    throw new Error(
      'recompose asked the operating system for a free port and the socket it bound carries no port number.',
    );
  }

  return bound.port;
}
