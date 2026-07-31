import { describe, expectTypeOf, test } from 'vitest';

import type { Settings } from './index';

describe('the settings document contract', () => {
  test('the document pins itself to schema version 3', () => {
    expectTypeOf<Settings['schemaVersion']>().toEqualTypeOf<3>();
  });

  test('the two switches the screen writes are plain booleans', () => {
    expectTypeOf<Settings['launchAtLogin']>().toEqualTypeOf<boolean>();
    expectTypeOf<Settings['showInMenuBar']>().toEqualTypeOf<boolean>();
  });

  test('the theme keeps the shape version 1 gave it', () => {
    expectTypeOf<Settings['theme']>().toEqualTypeOf<'system' | 'light' | 'dark'>();
  });

  test('the document holds exactly four fields, so nothing can name a port', () => {
    expectTypeOf<keyof Settings>().toEqualTypeOf<
      'schemaVersion' | 'theme' | 'launchAtLogin' | 'showInMenuBar'
    >();
  });

  test('no field names a port, because a port belongs to one gateway', () => {
    expectTypeOf<Settings>().not.toHaveProperty('enginePort');
    expectTypeOf<Settings>().not.toHaveProperty('port');
  });

  test('no field on the document names a token, because a token belongs to one gateway', () => {
    expectTypeOf<Settings>().not.toHaveProperty('token');
    expectTypeOf<Settings>().not.toHaveProperty('gatewayToken');
    expectTypeOf<Settings>().not.toHaveProperty('requireGatewayToken');
    expectTypeOf<Settings>().not.toHaveProperty('secret');
  });
});
