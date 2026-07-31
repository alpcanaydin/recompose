import { fc, test as propertyTest } from '@fast-check/vitest';
import { describe, expect, test } from 'vitest';

import {
  SETTINGS_SHORTCUT_ROUTE,
  getStartedRouteFor,
  newGatewayRouteFor,
  rendererBaseFor,
  rendererUrlFor,
  settingsShortcutRouteFor,
} from './renderer-url';

const packagedBase = 'app://renderer/index.html';
const devBase = 'http://localhost:5173';

describe('the document a window loads its routes from', () => {
  test('a development run takes the renderer the development server holds', () => {
    expect(rendererBaseFor(true, devBase)).toBe(devBase);
  });

  test('a packaged run takes the renderer the app scheme serves', () => {
    expect(rendererBaseFor(false, undefined)).toBe(packagedBase);
  });

  test('a packaged run ignores a development server address left in the environment', () => {
    expect(rendererBaseFor(false, devBase)).toBe(packagedBase);
  });

  test('a development run with no server address falls back to the served renderer', () => {
    expect(rendererBaseFor(true, undefined)).toBe(packagedBase);
    expect(rendererBaseFor(true, '')).toBe(packagedBase);
  });
});

describe('the address a window opens a route at', () => {
  test('the packaged renderer reaches a route through the fragment', () => {
    expect(rendererUrlFor(packagedBase, '/settings')).toBe('app://renderer/index.html#/settings');
  });

  test('the development server reaches the same route the same way', () => {
    expect(rendererUrlFor(devBase, '/settings')).toBe('http://localhost:5173#/settings');
  });

  test('the home route names itself rather than leaving the fragment off', () => {
    expect(rendererUrlFor(packagedBase, '/')).toBe('app://renderer/index.html#/');
  });

  test('the settings shortcut asks the surface it opens to place focus', () => {
    expect(rendererUrlFor(packagedBase, SETTINGS_SHORTCUT_ROUTE)).toBe(
      'app://renderer/index.html#/settings?focus=first-control',
    );
  });

  test('a settings arrival the shortcut never made carries no such request', () => {
    expect(rendererUrlFor(packagedBase, '/settings')).not.toContain('focus');
  });

  propertyTest.prop([fc.constantFrom(packagedBase, devBase), fc.stringMatching(/^\/[a-z/-]*$/)])(
    'every route hangs off the same document, one fragment deep',
    (base, route) => {
      const url = rendererUrlFor(base, route);

      expect(url.startsWith(`${base}#`)).toBe(true);
      expect(url.endsWith(route)).toBe(true);
      expect(url.split('#')).toHaveLength(2);
    },
  );
});

describe('the settings shortcut, pressed more than once', () => {
  test('each press names a location the router has not seen', () => {
    expect(settingsShortcutRouteFor(1)).not.toBe(settingsShortcutRouteFor(2));
  });

  test('every press still asks for the settings route and its focus', () => {
    expect(settingsShortcutRouteFor(7)).toContain(SETTINGS_SHORTCUT_ROUTE);
    expect(settingsShortcutRouteFor(7)).toContain('focus=first-control');
  });
});

describe('the route that opens the gateway creation sheet', () => {
  test('it carries the person to the canvas whatever surface they stand on', () => {
    expect(newGatewayRouteFor(1)).toBe('/?create=true&at=1');
  });

  test('each press names a location the router has not seen', () => {
    expect(newGatewayRouteFor(1)).not.toBe(newGatewayRouteFor(2));
  });

  test('every press still asks for the sheet', () => {
    expect(newGatewayRouteFor(9)).toContain('create=true');
  });
});

describe('the route that brings the get-started card back', () => {
  test('it asks the home surface to show the card', () => {
    expect(getStartedRouteFor(1)).toContain('/?getStarted=true');
  });

  test('each press names a location the router has not seen', () => {
    expect(getStartedRouteFor(1)).not.toBe(getStartedRouteFor(2));
  });

  test('it never asks for the creation sheet at the same time', () => {
    expect(getStartedRouteFor(3)).not.toContain('create');
  });
});
