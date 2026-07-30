import { fc, test as propertyTest } from '@fast-check/vitest';
import { describe, expect, test } from 'vitest';

import { previewAddressFor, portRefusal, slugRefusal } from './gateway-draft';

describe('the slug a person types', () => {
  test('a plain lowercase slug draws no refusal', () => {
    expect(slugRefusal('codex')).toBeUndefined();
  });

  test('a slug carrying an uppercase letter states the format the field accepts', () => {
    expect(slugRefusal('Codex')).toBe('Accepts lowercase letters, digits, and single dashes.');
  });

  test('a slug ending in a dash states the same format', () => {
    expect(slugRefusal('codex-')).toBe('Accepts lowercase letters, digits, and single dashes.');
  });

  test('a name Windows keeps for a device says so in its own words', () => {
    expect(slugRefusal('con')).toBe('Windows reserves this name.');
  });

  test('a slug longer than a hostname label allows draws a refusal', () => {
    expect(slugRefusal('a'.repeat(64))).toBeDefined();
    expect(slugRefusal('a'.repeat(63))).toBeUndefined();
  });
});

describe('the port a person types', () => {
  test('a port inside the accepted range draws no refusal', () => {
    expect(portRefusal('9000')).toBeUndefined();
  });

  test('a port under the range states the range', () => {
    expect(portRefusal('80')).toBe('Accepts 1024 through 65535.');
    expect(portRefusal('1023')).toBe('Accepts 1024 through 65535.');
  });

  test('a port over the range states the same range', () => {
    expect(portRefusal('65536')).toBe('Accepts 1024 through 65535.');
  });

  test('the ends of the range are inside it', () => {
    expect(portRefusal('1024')).toBeUndefined();
    expect(portRefusal('65535')).toBeUndefined();
  });

  test('a port field holding no number states the range rather than staying silent', () => {
    expect(portRefusal('')).toBe('Accepts 1024 through 65535.');
    expect(portRefusal('eight thousand')).toBe('Accepts 1024 through 65535.');
    expect(portRefusal('8000.5')).toBe('Accepts 1024 through 65535.');
  });

  propertyTest.prop([fc.integer({ min: 1024, max: 65535 })])(
    'every port the gateway contract accepts passes the field',
    (port) => {
      expect(portRefusal(String(port))).toBeUndefined();
    },
  );

  propertyTest.prop([fc.integer({ min: -5000, max: 1023 })])(
    'no port below the range passes the field',
    (port) => {
      expect(portRefusal(String(port))).toBeDefined();
    },
  );
});

describe('the address the sheet previews', () => {
  test('the preview carries the port the field holds', () => {
    expect(previewAddressFor('9000')).toBe('http://localhost:9000');
  });

  test('an empty port field drops the port rather than previewing half an address', () => {
    expect(previewAddressFor('')).toBe('http://localhost');
  });

  test('the preview names no path, because the gateway serves at its root', () => {
    expect(new URL(previewAddressFor('51234')).pathname).toBe('/');
  });
});
