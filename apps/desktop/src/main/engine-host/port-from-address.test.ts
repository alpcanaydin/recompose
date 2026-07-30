import { describe, expect, test } from 'vitest';

import { portFromAddress } from './port-from-address';

describe('reading the port the operating system handed back', () => {
  test('a bound loopback socket answers the port it took', () => {
    expect(portFromAddress({ address: '127.0.0.1', family: 'IPv4', port: 51234 })).toBe(51234);
  });

  test('a socket that never bound carries no port to offer', () => {
    expect(() => portFromAddress(null)).toThrow('no port');
  });

  test('a pipe carries no port either, because only a network socket has one', () => {
    expect(() => portFromAddress('/tmp/recompose.sock')).toThrow('no port');
  });
});
