import { fc, test as propertyTest } from '@fast-check/vitest';
import { describe, expect, test } from 'vitest';

import { previewAddressFor, portRefusal, nameRefusal } from './gateway-draft';

describe('the name a person types', () => {
  test('a plain name draws no refusal', () => {
    expect(nameRefusal('Codex')).toBeUndefined();
  });

  test('a name carrying spaces and punctuation draws no refusal, because the app derives around them', () => {
    expect(nameRefusal('Claude, Code & Friends')).toBeUndefined();
  });

  test('a name longer than a hostname label allows draws no refusal, because the app trims it', () => {
    expect(nameRefusal('A'.repeat(200))).toBeUndefined();
  });

  test('a name written in letters no slug can carry draws no refusal, because the app falls back', () => {
    expect(nameRefusal('网关')).toBeUndefined();
  });

  test('a name Windows keeps for a device says so in its own words', () => {
    expect(nameRefusal('Con')).toBe('Windows reserves this name.');
    expect(nameRefusal('lpt1')).toBe('Windows reserves this name.');
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
