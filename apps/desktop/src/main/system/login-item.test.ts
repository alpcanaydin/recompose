import { describe, expect, test } from 'vitest';

import { loginItemAvailabilityFor } from './login-item';

describe('whether the login item row can act', () => {
  test('a packaged macOS build reaches the operating system login item', () => {
    expect(loginItemAvailabilityFor('darwin', true)).toBe('available');
  });

  test('a packaged Windows build reaches the operating system login item', () => {
    expect(loginItemAvailabilityFor('win32', true)).toBe('available');
  });

  test('an unpackaged build waits, because a development login item points at Electron', () => {
    expect(loginItemAvailabilityFor('darwin', false)).toBe('unpackaged');
    expect(loginItemAvailabilityFor('win32', false)).toBe('unpackaged');
  });

  test('Linux never carries a login item, packaged or not', () => {
    expect(loginItemAvailabilityFor('linux', true)).toBe('unsupported');
    expect(loginItemAvailabilityFor('linux', false)).toBe('unsupported');
  });

  test('a platform recompose never ships to carries no login item either', () => {
    expect(loginItemAvailabilityFor('freebsd', true)).toBe('unsupported');
  });
});
