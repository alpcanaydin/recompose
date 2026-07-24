import { join } from 'path';
import { describe, expect, test } from 'vitest';

import { resolveRendererFile } from './renderer-path';

const root = '/opt/recompose/out/renderer';

describe('resolving app:// requests to renderer files', () => {
  test('the root request maps to index.html', () => {
    expect(resolveRendererFile(root, 'app://renderer/')).toEqual({
      filePath: join(root, 'index.html'),
    });
  });

  test('a nested asset maps under the renderer root', () => {
    expect(resolveRendererFile(root, 'app://renderer/assets/app.js')).toEqual({
      filePath: join(root, 'assets/app.js'),
    });
  });

  test('a decoded parent-directory escape is rejected as traversal', () => {
    expect(resolveRendererFile(root, 'app://renderer/../secret')).toEqual({
      rejected: 'traversal',
    });
  });

  test('a percent-encoded parent-directory escape is rejected as traversal', () => {
    expect(resolveRendererFile(root, 'app://renderer/%2e%2e/%2e%2e/secret')).toEqual({
      rejected: 'traversal',
    });
  });

  test('a non-app scheme is rejected', () => {
    expect(resolveRendererFile(root, 'file:///etc/passwd')).toEqual({
      rejected: 'not-app-scheme',
    });
  });

  test('a foreign app host is rejected', () => {
    expect(resolveRendererFile(root, 'app://evil/index.html')).toEqual({
      rejected: 'not-app-scheme',
    });
  });
});
