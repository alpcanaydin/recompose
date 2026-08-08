import { describe, expect, it, vi } from 'vitest';

import {
  antigravityLatestVersion,
  antigravityOnboardUserUserAgent,
  antigravityRequestUserAgent,
  antigravityUserAgent,
  antigravityVersionFromUserAgent,
  fetchAntigravityLatestVersion,
} from './antigravity-version';

describe('Antigravity Hub version and user agent parity', () => {
  it('should use the current Hub fallback version', () => {
    expect(antigravityLatestVersion()).toBe('2.2.1');
  });

  it('should build the short Hub-family user agent', () => {
    expect(antigravityUserAgent()).toBe('antigravity/hub/2.2.1 darwin/arm64');
  });

  it.each([
    ['antigravity/hub/2.2.1 darwin/arm64', '2.2.1'],
    ['antigravity/1.23.2 windows/amd64', '1.23.2'],
  ])('should parse the version from %s', (userAgent, expected) => {
    expect(antigravityVersionFromUserAgent(userAgent)).toBe(expected);
  });

  it('should use the short user agent for loadCodeAssist and runtime requests', () => {
    const short = 'antigravity/hub/2.2.1 darwin/arm64';

    expect(antigravityRequestUserAgent('')).toBe(short);
    expect(antigravityRequestUserAgent(short)).toBe(short);
  });

  it('should use the long control-plane user agent for onboarding', () => {
    expect(antigravityOnboardUserUserAgent('')).toBe(
      'antigravity/hub/2.2.1 darwin/arm64 google-api-nodejs-client/10.3.0',
    );
  });
});

describe('Antigravity Hub manifest parity', () => {
  it('should fetch the Hub manifest with updater headers', async () => {
    const fetchLike = vi.fn<typeof fetch>(async (_input, init) => {
      expect(new Headers(init?.headers).get('User-Agent')).toBe('electron-builder');
      expect(new Headers(init?.headers).get('Cache-Control')).toBe('no-cache');
      await Promise.resolve();

      return new Response('version: 2.2.1\npath: Antigravity-arm64-mac.zip\n');
    });

    await expect(
      fetchAntigravityLatestVersion(fetchLike, 'https://manifest.test/latest.yml'),
    ).resolves.toBe('2.2.1');
  });

  it('should surface a Hub manifest HTTP error', async () => {
    const fetchLike = vi.fn<typeof fetch>(async () => {
      await Promise.resolve();

      return new Response('outage', { status: 500 });
    });

    await expect(
      fetchAntigravityLatestVersion(fetchLike, 'https://manifest.test/latest.yml'),
    ).rejects.toThrow('returned 500');
  });

  it('TestGetBytesEnforcesMaxSize', async () => {
    const oversized = `version: 2.2.1\n${'x'.repeat(4_096)}`;
    const fetchLike = vi.fn<typeof fetch>(async () => {
      await Promise.resolve();

      return new Response(oversized);
    });

    await expect(
      fetchAntigravityLatestVersion(fetchLike, 'https://manifest.test/latest.yml'),
    ).rejects.toThrow('maximum allowed size of 4096 bytes');
  });
});
