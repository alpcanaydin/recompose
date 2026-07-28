import { fc, test as propertyTest } from '@fast-check/vitest';
import { describe, expect, test } from 'vitest';

import { rendererUrlFor } from './renderer-url';

const packagedBase = 'app://renderer/index.html';
const devBase = 'http://localhost:5173';

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
