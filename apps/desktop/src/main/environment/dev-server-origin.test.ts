import { afterEach, describe, expect, test, vi } from 'vitest';

import { devServerOrigin } from './dev-server-origin';

describe('resolving the dev server origin', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('a packaged run ignores the dev server env var', () => {
    vi.stubEnv('ELECTRON_RENDERER_URL', 'http://localhost:5173');

    expect(devServerOrigin(false)).toBeUndefined();
  });

  test('a dev run with the env var set yields its origin', () => {
    vi.stubEnv('ELECTRON_RENDERER_URL', 'http://localhost:5173/index.html');

    expect(devServerOrigin(true)).toBe('http://localhost:5173');
  });

  test('a dev run without the env var yields undefined', () => {
    vi.stubEnv('ELECTRON_RENDERER_URL', '');

    expect(devServerOrigin(true)).toBeUndefined();
  });

  test('a dev run with a malformed env var yields undefined', () => {
    vi.stubEnv('ELECTRON_RENDERER_URL', 'not a url');

    expect(devServerOrigin(true)).toBeUndefined();
  });

  test('a dev run with a non-network scheme yields undefined', () => {
    vi.stubEnv('ELECTRON_RENDERER_URL', 'file:///tmp/renderer/index.html');

    expect(devServerOrigin(true)).toBeUndefined();
  });
});
