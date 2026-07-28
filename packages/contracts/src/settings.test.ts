import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import { defaultSettings, ENGINE_PORT_RANGE, loadSettings } from './settings';

describe('app settings', () => {
  test('defaults: system theme, engine on 8397, every switch off', () => {
    expect(defaultSettings()).toEqual({
      schemaVersion: 2,
      theme: 'system',
      enginePort: 8397,
      launchAtLogin: false,
      showInMenuBar: false,
      requireGatewayToken: false,
    });
  });

  test('a stored settings file parses and keeps its shape', () => {
    const stored = {
      schemaVersion: 2,
      theme: 'dark',
      enginePort: 9000,
      launchAtLogin: true,
      showInMenuBar: true,
      requireGatewayToken: true,
    };

    expect(loadSettings(stored)).toEqual(stored);
  });

  test('unknown keys are rejected', () => {
    expect(() => loadSettings({ ...defaultSettings(), telemetry: true })).toThrow();
  });

  test('a missing switch is rejected rather than quietly defaulted', () => {
    const { requireGatewayToken, ...withoutTheSwitch } = defaultSettings();

    expect(requireGatewayToken).toBe(false);
    expect(() => loadSettings(withoutTheSwitch)).toThrow();
  });
});

describe('a stored version 1 settings document', () => {
  test('it migrates forward keeping the theme and the port it held', () => {
    const storedUnderVersionOne = { schemaVersion: 1, theme: 'dark', enginePort: 9000 };

    expect(loadSettings(storedUnderVersionOne)).toEqual({
      schemaVersion: 2,
      theme: 'dark',
      enginePort: 9000,
      launchAtLogin: false,
      showInMenuBar: false,
      requireGatewayToken: false,
    });
  });

  const versionOneDocuments = fc.record({
    schemaVersion: fc.constant(1),
    theme: fc.constantFrom('system', 'light', 'dark'),
    enginePort: fc.integer({ min: ENGINE_PORT_RANGE.min, max: ENGINE_PORT_RANGE.max }),
  });

  test.prop([versionOneDocuments])(
    'every version 1 document reaches version 2 with its choices intact and its switches off',
    (storedUnderVersionOne) => {
      expect(loadSettings(storedUnderVersionOne)).toEqual({
        ...storedUnderVersionOne,
        schemaVersion: 2,
        launchAtLogin: false,
        showInMenuBar: false,
        requireGatewayToken: false,
      });
    },
  );
});

describe('the engine port range', () => {
  test('it spans the unprivileged ports', () => {
    expect(ENGINE_PORT_RANGE).toEqual({ min: 1024, max: 65535 });
  });

  test('ports outside the unprivileged range are rejected', () => {
    for (const port of [0, 80, 1023, 65536]) {
      expect(() => loadSettings({ ...defaultSettings(), enginePort: port })).toThrow();
    }
  });

  const portsCrowdingBothEdges = fc.oneof(
    fc.integer({ min: ENGINE_PORT_RANGE.min - 4, max: ENGINE_PORT_RANGE.min + 4 }),
    fc.integer({ min: ENGINE_PORT_RANGE.max - 4, max: ENGINE_PORT_RANGE.max + 4 }),
    fc.integer({ min: -1000, max: 70000 }),
  );

  test.prop([portsCrowdingBothEdges])(
    'a port parses exactly when it falls inside the published range',
    (port) => {
      const parse = () => loadSettings({ ...defaultSettings(), enginePort: port });

      if (port >= ENGINE_PORT_RANGE.min && port <= ENGINE_PORT_RANGE.max) {
        expect(parse()).toMatchObject({ enginePort: port });
      } else {
        expect(parse).toThrow();
      }
    },
  );
});
