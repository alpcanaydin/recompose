import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import { windowOptionsFor } from './window-options';

const somePreload = '/app/preload/index.js';
const someIcon = '/app/resources/icon.png';

describe('window chrome per platform', () => {
  test('macOS gets transparent glass chrome with inset traffic lights', () => {
    const options = windowOptionsFor('darwin', somePreload, someIcon);

    expect(options.transparent).toBe(true);
    expect(options.titleBarStyle).toBe('hiddenInset');
    expect(options.icon).toBeUndefined();
  });

  test('Linux gets the app icon and default chrome', () => {
    const options = windowOptionsFor('linux', somePreload, someIcon);

    expect(options.icon).toBe(someIcon);
    expect(options.transparent).toBeUndefined();
    expect(options.titleBarStyle).toBeUndefined();
  });

  test('Windows gets default chrome without an icon override', () => {
    const options = windowOptionsFor('win32', somePreload, someIcon);

    expect(options.transparent).toBeUndefined();
    expect(options.titleBarStyle).toBeUndefined();
    expect(options.icon).toBeUndefined();
  });

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

  test.prop([anyPlatform])(
    'every platform gets the same hidden-until-ready frame wired to the preload',
    (platform) => {
      const options = windowOptionsFor(platform, somePreload, someIcon);

      expect(options.width).toBe(900);
      expect(options.height).toBe(670);
      expect(options.show).toBe(false);
      expect(options.autoHideMenuBar).toBe(true);
      expect(options.webPreferences?.preload).toBe(somePreload);
      expect(options.webPreferences?.sandbox).toBe(false);
    },
  );
});
