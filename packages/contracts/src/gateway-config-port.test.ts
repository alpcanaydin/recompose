import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import { GATEWAY_CONFIG_VERSION, GATEWAY_PORT_RANGE, gatewayConfigSchema } from './gateway-config';

const validConfig = {
  schemaVersion: GATEWAY_CONFIG_VERSION,
  slug: 'my-gateway',
  displayName: 'My Gateway',
  port: 8397,
  virtualModels: [],
  layout: { nodes: {} },
};

describe('the port a gateway answers on', () => {
  test('a gateway carries the port it serves', () => {
    expect(gatewayConfigSchema.parse(validConfig).port).toBe(8397);
  });

  test('a gateway with no port is refused, because an address needs one', () => {
    const { port, ...withoutPort } = validConfig;

    expect(port).toBe(8397);
    expect(() => gatewayConfigSchema.parse(withoutPort)).toThrow();
  });

  test('the published range spans the unprivileged ports', () => {
    expect(GATEWAY_PORT_RANGE).toEqual({ min: 1024, max: 65535 });
  });

  test('a port sitting on either edge of the range parses', () => {
    for (const port of [GATEWAY_PORT_RANGE.min, GATEWAY_PORT_RANGE.max]) {
      expect(gatewayConfigSchema.parse({ ...validConfig, port }).port).toBe(port);
    }
  });

  test('a port one step outside either edge is refused', () => {
    for (const port of [GATEWAY_PORT_RANGE.min - 1, GATEWAY_PORT_RANGE.max + 1]) {
      expect(() => gatewayConfigSchema.parse({ ...validConfig, port })).toThrow();
    }
  });

  test('a privileged port and a fractional port are both refused', () => {
    for (const port of [0, 80, 443, 8397.5]) {
      expect(() => gatewayConfigSchema.parse({ ...validConfig, port })).toThrow();
    }
  });
});

const portsCrowdingBothEdgesArb = fc.oneof(
  fc.integer({ min: GATEWAY_PORT_RANGE.min - 4, max: GATEWAY_PORT_RANGE.min + 4 }),
  fc.integer({ min: GATEWAY_PORT_RANGE.max - 4, max: GATEWAY_PORT_RANGE.max + 4 }),
  fc.integer({ min: -1000, max: 70000 }),
);

describe('the port range and the schema agree', () => {
  test.prop([portsCrowdingBothEdgesArb])(
    'a port parses exactly when it falls inside the published range',
    (port) => {
      const parse = () => gatewayConfigSchema.parse({ ...validConfig, port });

      if (port >= GATEWAY_PORT_RANGE.min && port <= GATEWAY_PORT_RANGE.max) {
        expect(parse().port).toBe(port);
      } else {
        expect(parse).toThrow();
      }
    },
  );
});
