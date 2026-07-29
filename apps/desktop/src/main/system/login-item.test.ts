import { fc, test as propertyTest } from '@fast-check/vitest';
import { describe, expect, test } from 'vitest';

import type { LoginItemPort } from './login-item';

import { createLoginItem, loginItemAvailabilityFor } from './login-item';

const packagedExecutable = '/Applications/recompose.app/Contents/MacOS/recompose';

function entryFor(target: { path: string; args: string[] }): string {
  return [target.path, ...target.args].join(' ');
}

function fakeOperatingSystem(): LoginItemPort & { registrations: number } {
  const startupEntries = new Set<string>();

  return {
    get registrations() {
      return startupEntries.size;
    },
    getLoginItemSettings: (options) => ({ openAtLogin: startupEntries.has(entryFor(options)) }),
    setLoginItemSettings: (settings) => {
      if (settings.openAtLogin) {
        startupEntries.add(entryFor(settings));
      } else {
        startupEntries.delete(entryFor(settings));
      }
    },
  };
}

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

describe('the launch-at-login switch against the operating system', () => {
  test('turning it on leaves the operating system listing recompose', () => {
    const operatingSystem = fakeOperatingSystem();
    const loginItem = createLoginItem(operatingSystem, 'available', packagedExecutable);

    loginItem.setEnabled(true);

    expect(loginItem.isEnabled()).toBe(true);
  });

  test('turning it off again leaves the operating system listing nothing', () => {
    const operatingSystem = fakeOperatingSystem();
    const loginItem = createLoginItem(operatingSystem, 'available', packagedExecutable);

    loginItem.setEnabled(true);
    loginItem.setEnabled(false);

    expect(loginItem.isEnabled()).toBe(false);
    expect(operatingSystem.registrations).toBe(0);
  });

  test('turning it on twice leaves one registration behind', () => {
    const operatingSystem = fakeOperatingSystem();
    const loginItem = createLoginItem(operatingSystem, 'available', packagedExecutable);

    loginItem.setEnabled(true);
    loginItem.setEnabled(true);

    expect(operatingSystem.registrations).toBe(1);
  });

  test('a development build writes no login item, because it would point at Electron', () => {
    const operatingSystem = fakeOperatingSystem();
    const loginItem = createLoginItem(operatingSystem, 'unpackaged', '/tmp/node_modules/electron');

    loginItem.setEnabled(true);

    expect(operatingSystem.registrations).toBe(0);
    expect(loginItem.isEnabled()).toBe(false);
  });

  test('a platform without a login item writes nothing', () => {
    const operatingSystem = fakeOperatingSystem();
    const loginItem = createLoginItem(operatingSystem, 'unsupported', packagedExecutable);

    loginItem.setEnabled(true);

    expect(operatingSystem.registrations).toBe(0);
    expect(loginItem.isEnabled()).toBe(false);
  });
});

describe('a platform the login item never reaches', () => {
  test('a platform without a login item is never asked what it holds', () => {
    const operatingSystem = fakeOperatingSystem();
    let reads = 0;
    const watched = {
      ...operatingSystem,
      getLoginItemSettings: (options: { path: string; args: string[] }) => {
        reads += 1;

        return operatingSystem.getLoginItemSettings(options);
      },
    };

    operatingSystem.setLoginItemSettings({ path: packagedExecutable, args: [], openAtLogin: true });

    const loginItem = createLoginItem(watched, 'unsupported', packagedExecutable);

    expect(loginItem.isEnabled()).toBe(false);
    expect(reads).toBe(0);
  });
});

describe('the read and the write name the same executable', () => {
  propertyTest.prop([fc.string({ minLength: 1 }), fc.boolean()])(
    'whatever the switch writes for an executable, the switch reads back',
    (executablePath, enabled) => {
      const loginItem = createLoginItem(fakeOperatingSystem(), 'available', executablePath);

      loginItem.setEnabled(enabled);

      expect(loginItem.isEnabled()).toBe(enabled);
    },
  );
});
