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

describe('Antigravity Hub user agent families', () => {
  it('should leave a user agent outside the Hub family untouched', () => {
    expect(antigravityRequestUserAgent('curl/8.7.1')).toBe('curl/8.7.1');
    expect(antigravityOnboardUserUserAgent('curl/8.7.1')).toBe('curl/8.7.1');
  });

  it('should keep an onboarding user agent that already names the Node client', () => {
    const configured = 'antigravity/hub/2.0.0 darwin/arm64 google-api-nodejs-client/9.0.0';

    expect(antigravityOnboardUserUserAgent(configured)).toBe(configured);
  });

  it('should append the Node client to a bare Hub-family onboarding user agent', () => {
    expect(antigravityOnboardUserUserAgent('antigravity/1.23.2 windows/amd64')).toBe(
      'antigravity/1.23.2 windows/amd64 google-api-nodejs-client/10.3.0',
    );
  });

  it('should drop the Node client from a Hub-family runtime user agent', () => {
    expect(
      antigravityRequestUserAgent(
        'antigravity/hub/2.0.0 darwin/arm64 google-api-nodejs-client/9.0.0',
      ),
    ).toBe('antigravity/hub/2.0.0 darwin/arm64');
  });

  it('should build the Hub user agent for an explicitly named version', () => {
    expect(antigravityUserAgent('3.0.0')).toBe('antigravity/hub/3.0.0 darwin/arm64');
  });

  it.each([
    ['curl/8.7.1', '2.2.1'],
    ['', '2.2.1'],
  ])('should fall back to the Hub version when "%s" names none', (userAgent, expected) => {
    expect(antigravityVersionFromUserAgent(userAgent)).toBe(expected);
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

describe('Antigravity Hub manifest refusals', () => {
  it('should reject a Hub manifest that carries no body', async () => {
    const fetchLike = vi.fn<typeof fetch>(async () => {
      await Promise.resolve();

      return new Response(null, { status: 200 });
    });

    await expect(fetchAntigravityLatestVersion(fetchLike)).rejects.toThrow('returned no version');
  });

  it('should reject a Hub manifest whose body names no version', async () => {
    const fetchLike = vi.fn<typeof fetch>(async () => {
      await Promise.resolve();

      return new Response('path: Antigravity-arm64-mac.zip\n');
    });

    await expect(
      fetchAntigravityLatestVersion(fetchLike, 'https://manifest.test/latest.yml'),
    ).rejects.toThrow('returned no version');
  });
});
