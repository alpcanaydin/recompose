import { describe, expect, test } from 'vitest';

import { fileBrowserFor } from './file-browser';

describe('the file browser a platform ships', () => {
  test('macOS opens folders in Finder', () => {
    expect(fileBrowserFor('darwin')).toBe('finder');
  });

  test('Windows opens folders in Explorer', () => {
    expect(fileBrowserFor('win32')).toBe('explorer');
  });

  test('Linux opens folders in whichever file manager the desktop provides', () => {
    expect(fileBrowserFor('linux')).toBe('file-manager');
  });

  test('a platform recompose never ships to falls back to the generic file manager', () => {
    expect(fileBrowserFor('freebsd')).toBe('file-manager');
  });
});
