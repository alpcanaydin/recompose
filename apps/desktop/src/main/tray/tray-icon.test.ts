import { fc, test as propertyTest } from '@fast-check/vitest';
import { describe, expect, test } from 'vitest';

import { trayIconFor } from './tray-icon';

const sources = {
  template: '/app/trayTemplate.png',
  templateRetina: '/app/trayTemplate@2x.png',
  coloured: '/app/tray.png',
};

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
  test('macOS takes the template image, which its menu bar inverts and doubles for itself', () => {
    expect(trayIconFor('darwin', sources)).toEqual({
      source: sources.template,
      retinaSource: sources.templateRetina,
      template: true,
    });
  });

  test('Windows takes the coloured mark, which a black glyph would lose on a dark taskbar', () => {
    expect(trayIconFor('win32', sources)).toEqual({
      source: sources.coloured,
      retinaSource: null,
      template: false,
    });
  });

  test('Linux takes the coloured mark for the same reason', () => {
    expect(trayIconFor('linux', sources)).toEqual({
      source: sources.coloured,
      retinaSource: null,
      template: false,
    });
  });

  propertyTest.prop([anyPlatform])(
    'only macOS carries the template image, its second representation, and the template flag',
    (platform) => {
      const icon = trayIconFor(platform, sources);

      expect(icon.template).toBe(platform === 'darwin');
      expect(icon.source).toBe(platform === 'darwin' ? sources.template : sources.coloured);
      expect(icon.retinaSource).toBe(platform === 'darwin' ? sources.templateRetina : null);
    },
  );
});
