import { fc, test as propertyTest } from '@fast-check/vitest';
import { describe, expect, test } from 'vitest';

import { trayIconSourceFor } from './tray-icon';

const sources = { template: '/app/trayTemplate.png', coloured: '/app/tray.png' };

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

describe('the icon a platform shows in its menu bar', () => {
  test('macOS takes the template image, which the menu bar inverts for itself', () => {
    expect(trayIconSourceFor('darwin', sources)).toBe(sources.template);
  });

  test('Windows takes the coloured mark, which a black glyph would lose on a dark taskbar', () => {
    expect(trayIconSourceFor('win32', sources)).toBe(sources.coloured);
  });

  test('Linux takes the coloured mark for the same reason', () => {
    expect(trayIconSourceFor('linux', sources)).toBe(sources.coloured);
  });

  propertyTest.prop([anyPlatform])('only macOS takes the template image', (platform) => {
    expect(trayIconSourceFor(platform, sources)).toBe(
      platform === 'darwin' ? sources.template : sources.coloured,
    );
  });
});
