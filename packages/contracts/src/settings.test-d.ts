import { describe, expectTypeOf, test } from 'vitest';

import type { Settings } from './index';

describe('the settings document contract', () => {
  test('the document pins itself to schema version 2', () => {
    expectTypeOf<Settings['schemaVersion']>().toEqualTypeOf<2>();
  });

  test('the three switches the screen writes are plain booleans', () => {
    expectTypeOf<Settings['launchAtLogin']>().toEqualTypeOf<boolean>();
    expectTypeOf<Settings['showInMenuBar']>().toEqualTypeOf<boolean>();
    expectTypeOf<Settings['requireGatewayToken']>().toEqualTypeOf<boolean>();
  });

  test('the theme and the port keep the shape version 1 gave them', () => {
    expectTypeOf<Settings['theme']>().toEqualTypeOf<'system' | 'light' | 'dark'>();
    expectTypeOf<Settings['enginePort']>().toEqualTypeOf<number>();
  });

  test('the document holds exactly six fields, so nothing can name a token', () => {
    expectTypeOf<keyof Settings>().toEqualTypeOf<
      | 'schemaVersion'
      | 'theme'
      | 'enginePort'
      | 'launchAtLogin'
      | 'showInMenuBar'
      | 'requireGatewayToken'
    >();
  });

  test('no field on the document names a token', () => {
    expectTypeOf<Settings>().not.toHaveProperty('token');
    expectTypeOf<Settings>().not.toHaveProperty('gatewayToken');
    expectTypeOf<Settings>().not.toHaveProperty('secret');
  });
});
