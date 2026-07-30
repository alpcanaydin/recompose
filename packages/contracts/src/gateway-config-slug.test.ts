import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import { GATEWAY_CONFIG_VERSION, gatewayConfigSchema } from './gateway-config';

const validConfig = {
  schemaVersion: GATEWAY_CONFIG_VERSION,
  slug: 'my-gateway',
  displayName: 'My Gateway',
  port: 8397,
  virtualModels: [],
  layout: { nodes: {} },
};

const namesWindowsReserves = [
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9',
] as const;

describe('the slug a gateway names its file with', () => {
  test('a slug of 63 characters parses, the longest a hostname label allows', () => {
    const atTheBound = 'a'.repeat(63);

    expect(gatewayConfigSchema.parse({ ...validConfig, slug: atTheBound }).slug).toBe(atTheBound);
  });

  test('a slug of 64 characters is refused', () => {
    expect(() => gatewayConfigSchema.parse({ ...validConfig, slug: 'a'.repeat(64) })).toThrow();
  });

  test('a slug naming a device Windows reserves is refused', () => {
    for (const reserved of namesWindowsReserves) {
      expect(() => gatewayConfigSchema.parse({ ...validConfig, slug: reserved })).toThrow();
    }
  });

  test('a reserved name inside a longer slug parses, because Windows reserves only the name', () => {
    for (const slug of ['con-fig', 'my-con', 'console', 'com10', 'lpt0']) {
      expect(gatewayConfigSchema.parse({ ...validConfig, slug }).slug).toBe(slug);
    }
  });
});

const slugsCrowdingTheBoundArb = fc
  .array(fc.stringMatching(/^[a-z0-9]{1,8}$/), { minLength: 2, maxLength: 12 })
  .map((segments) => segments.join('-'))
  .filter((slug) => slug.length <= 63);

describe('the slug grammar and the bound agree', () => {
  test.prop([slugsCrowdingTheBoundArb])(
    'every dashed slug the grammar accepts inside the bound parses',
    (slug) => {
      expect(gatewayConfigSchema.parse({ ...validConfig, slug }).slug).toBe(slug);
    },
  );

  test.prop([fc.constantFrom(...namesWindowsReserves)])(
    'no name Windows reserves ever passes as a slug',
    (reserved) => {
      expect(() => gatewayConfigSchema.parse({ ...validConfig, slug: reserved })).toThrow();
    },
  );
});
