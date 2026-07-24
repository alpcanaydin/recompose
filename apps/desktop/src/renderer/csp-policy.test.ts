import { describe, expect, test } from 'vitest';

import { contentSecurityPolicy, injectContentSecurityPolicy } from './csp-policy';

describe('content security policy per build mode', () => {
  test('production forbids inline styles', () => {
    const policy = contentSecurityPolicy('build');

    expect(policy).toContain("style-src 'self'");
    expect(policy).not.toContain("'unsafe-inline'");
  });

  test('development allows inline styles for hot reload', () => {
    const policy = contentSecurityPolicy('serve');

    expect(policy).toContain("style-src 'self' 'unsafe-inline'");
  });

  test('both modes keep the default and script sources locked to self', () => {
    for (const mode of ['serve', 'build'] as const) {
      const policy = contentSecurityPolicy(mode);

      expect(policy).toContain("default-src 'self'");
      expect(policy).toContain("script-src 'self'");
      expect(policy).toContain("img-src 'self' data:");
    }
  });
});

describe('inject content security policy', () => {
  test('the placeholder swaps for the mode policy', () => {
    const html = '<meta content="__CSP__" />';

    expect(injectContentSecurityPolicy(html, 'build')).toBe(
      `<meta content="${contentSecurityPolicy('build')}" />`,
    );
  });

  test('a document without the placeholder fails the build', () => {
    expect(() => injectContentSecurityPolicy('<html></html>', 'build')).toThrow('__CSP__');
  });
});
