import { describe, expect, test } from 'vitest';

import { defaultSettings, loadSettings } from './settings';

describe('app settings', () => {
  test('defaults: system theme, engine on 8397', () => {
    expect(defaultSettings()).toEqual({ schemaVersion: 1, theme: 'system', enginePort: 8397 });
  });

  test('a stored settings file parses and keeps its shape', () => {
    const stored = { schemaVersion: 1, theme: 'dark', enginePort: 9000 };

    expect(loadSettings(stored)).toEqual(stored);
  });

  test('ports outside the unprivileged range are rejected', () => {
    for (const port of [0, 80, 1023, 65536]) {
      expect(() => loadSettings({ schemaVersion: 1, theme: 'system', enginePort: port })).toThrow();
    }
  });

  test('unknown keys are rejected', () => {
    expect(() =>
      loadSettings({ schemaVersion: 1, theme: 'system', enginePort: 8397, telemetry: true }),
    ).toThrow();
  });
});
