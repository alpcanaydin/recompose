import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import { windowOptionsFor } from './window-options';

const somePreload = '/app/preload/index.js';
const someIcon = '/app/resources/icon.png';

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

describe('window chrome per platform', () => {
  test('macOS gets transparent glass chrome with inset traffic lights', () => {
    const options = windowOptionsFor('darwin', somePreload, someIcon);

    expect(options.transparent).toBe(true);
    expect(options.titleBarStyle).toBe('hidden');
    expect(options.trafficLightPosition).toEqual({ x: 14, y: 12 });
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
});

describe('what every window promises before it shows', () => {
  test('it stays hidden until the renderer paints, and reaches the preload sandboxed', () => {
    const options = windowOptionsFor('darwin', somePreload, someIcon);

    expect(options.show).toBe(false);
    expect(options.autoHideMenuBar).toBe(true);
    expect(options.webPreferences?.preload).toBe(somePreload);
    expect(options.webPreferences?.sandbox).toBe(true);
  });
});

describe('window chrome contract across all platforms', () => {
  test.prop([anyPlatform])(
    'every platform gets the same hidden-until-ready frame wired to the preload',
    (platform) => {
      const options = windowOptionsFor(platform, somePreload, someIcon);

      expect(options.width).toBe(1120);
      expect(options.height).toBe(780);
      expect(options.show).toBe(false);
      expect(options.autoHideMenuBar).toBe(true);
      expect(options.webPreferences?.preload).toBe(somePreload);
      expect(options.webPreferences?.sandbox).toBe(true);
    },
  );

  test.prop([anyPlatform])(
    'every platform gets a floor, below which the settings column tears',
    (platform) => {
      const options = windowOptionsFor(platform, somePreload, someIcon);

      expect(options.minWidth).toBe(720);
      expect(options.minHeight).toBe(500);
    },
  );

  test.prop([anyPlatform])(
    'only macOS gets glass chrome and only Linux gets the icon',
    (platform) => {
      const options = windowOptionsFor(platform, somePreload, someIcon);

      expect(options.transparent).toBe(platform === 'darwin' ? true : undefined);
      expect(options.titleBarStyle).toBe(platform === 'darwin' ? 'hidden' : undefined);
      expect(options.icon).toBe(platform === 'linux' ? someIcon : undefined);
    },
  );
});
