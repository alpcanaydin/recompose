import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import { allowsPermission, ALLOWED_PERMISSIONS } from './permission-policy';

const EVERY_PERMISSION_ELECTRON_ASKS_ABOUT = [
  'clipboard-read',
  'clipboard-sanitized-write',
  'display-capture',
  'fileSystem',
  'fullscreen',
  'geolocation',
  'hid',
  'idle-detection',
  'keyboardLock',
  'media',
  'mediaKeySystem',
  'midi',
  'midiSysex',
  'notifications',
  'openExternal',
  'pointerLock',
  'serial',
  'speaker-selection',
  'storage-access',
  'top-level-storage-access',
  'unknown',
  'usb',
  'window-management',
];

describe('the one permission recompose opens', () => {
  test('the allowed set holds exactly the clipboard write the address pill needs', () => {
    expect([...ALLOWED_PERMISSIONS]).toEqual(['clipboard-sanitized-write']);
  });

  test('copying a gateway address is allowed', () => {
    expect(allowsPermission('clipboard-sanitized-write')).toBe(true);
  });
});

describe('what the policy still denies', () => {
  test('every other permission Electron asks about is denied', () => {
    const allowed = EVERY_PERMISSION_ELECTRON_ASKS_ABOUT.filter((permission) =>
      allowsPermission(permission),
    );

    expect(allowed).toEqual(['clipboard-sanitized-write']);
  });

  test('reading the clipboard back stays denied, because only writing was asked for', () => {
    expect(allowsPermission('clipboard-read')).toBe(false);
  });

  test.prop([fc.string().filter((name) => name !== 'clipboard-sanitized-write')])(
    'no permission outside the allowed set is ever granted',
    (permission) => {
      expect(allowsPermission(permission)).toBe(false);
    },
  );
});
