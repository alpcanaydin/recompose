import { fc, test as propertyTest } from '@fast-check/vitest';
import { describe, expect, test } from 'vitest';

import { shouldQuitOnLastWindowClose } from './quit-policy';

const anyPlatform = fc.constantFrom<NodeJS.Platform>(
  'aix',
  'android',
  'cygwin',
  'darwin',
  'freebsd',
  'haiku',
  'linux',
  'netbsd',
  'openbsd',
  'sunos',
  'win32',
);

describe('what closing the last window means', () => {
  test('Windows without a tray quits, the platform default', () => {
    expect(shouldQuitOnLastWindowClose('win32', false)).toBe(true);
  });

  test('Linux without a tray quits for the same reason', () => {
    expect(shouldQuitOnLastWindowClose('linux', false)).toBe(true);
  });

  test('a showing tray keeps the app alive on Windows', () => {
    expect(shouldQuitOnLastWindowClose('win32', true)).toBe(false);
  });

  test('a showing tray keeps the app alive on Linux', () => {
    expect(shouldQuitOnLastWindowClose('linux', true)).toBe(false);
  });

  test('macOS keeps the app alive either way, as its own convention asks', () => {
    expect(shouldQuitOnLastWindowClose('darwin', false)).toBe(false);
    expect(shouldQuitOnLastWindowClose('darwin', true)).toBe(false);
  });

  propertyTest.prop([anyPlatform, fc.boolean()])(
    'the app quits only where the platform expects it and nothing holds it open',
    (platform, menuBarVisible) => {
      expect(shouldQuitOnLastWindowClose(platform, menuBarVisible)).toBe(
        platform !== 'darwin' && !menuBarVisible,
      );
    },
  );
});
