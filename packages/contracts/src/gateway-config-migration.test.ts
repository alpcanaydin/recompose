import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import { GATEWAY_CONFIG_VERSION, GATEWAY_PORT_RANGE, loadGatewayConfig } from './gateway-config';

const storedUnderVersionOne = {
  schemaVersion: 1,
  slug: 'my-gateway',
  displayName: 'My Gateway',
  port: 8397,
  virtualModels: [],
  layout: { nodes: { gateway: { x: 0, y: 0 } } },
};

describe('a gateway stored before virtual models bound to one target', () => {
  test('the version stamp reads 2, so the shape before it has a version to come from', () => {
    expect(GATEWAY_CONFIG_VERSION).toBe(2);
  });

  test('a version 1 document loads as a version 2 document', () => {
    expect(loadGatewayConfig(storedUnderVersionOne).schemaVersion).toBe(2);
  });

  test('the restamp carries the gateway forward untouched, because it held no binding', () => {
    expect(loadGatewayConfig(storedUnderVersionOne)).toEqual({
      ...storedUnderVersionOne,
      schemaVersion: 2,
    });
  });

  test('a document already at version 2 loads unchanged', () => {
    const current = { ...storedUnderVersionOne, schemaVersion: 2 };

    expect(loadGatewayConfig(current)).toEqual(current);
  });

  test('a document from a version this build never learned is refused', () => {
    expect(() => loadGatewayConfig({ ...storedUnderVersionOne, schemaVersion: 99 })).toThrow(
      /newer/,
    );
  });

  test('a version 1 document the restamp cannot rescue still fails validation', () => {
    expect(() => loadGatewayConfig({ ...storedUnderVersionOne, slug: 'x!' })).toThrow();
  });
});

const slugSegmentArb = fc.stringMatching(/^[a-z0-9]{1,6}$/);
const slugArb = fc
  .array(slugSegmentArb, { minLength: 1, maxLength: 4 })
  .map((segments) => segments.join('-'))
  .filter((slug) => !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(slug));

const trimmedDisplayNameArb = fc
  .string({ minLength: 1, maxLength: 40 })
  .map((value) => value.trim())
  .filter((value) => value.length > 0);

const versionOneDocumentArb = fc.record({
  schemaVersion: fc.constant(1),
  slug: slugArb,
  displayName: trimmedDisplayNameArb,
  port: fc.integer({ min: GATEWAY_PORT_RANGE.min, max: GATEWAY_PORT_RANGE.max }),
  virtualModels: fc.constant([]),
  layout: fc.record({
    nodes: fc.dictionary(
      slugArb,
      fc.record({
        x: fc.integer({ min: -10000, max: 10000 }),
        y: fc.integer({ min: -10000, max: 10000 }),
      }),
    ),
  }),
});

describe('the restamp holds for every gateway a shipped build ever wrote', () => {
  test.prop([versionOneDocumentArb])(
    'any stored version 1 document loads as a valid version 2 document',
    (document) => {
      const loaded = loadGatewayConfig(document);

      expect(loaded).toEqual({ ...document, schemaVersion: 2 });
    },
  );
});
