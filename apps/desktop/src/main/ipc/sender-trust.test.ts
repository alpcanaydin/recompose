import { describe, expect, test } from 'vitest';

import { assertTrustedSender, type AllowedOrigins, type TrustedSender } from './sender-trust';

const devOrigins: AllowedOrigins = { devServerOrigin: 'http://localhost:5173' };
const noDevOrigin: AllowedOrigins = { devServerOrigin: undefined };

describe('sender trust: accepted senders', () => {
  test('the packaged app main frame (file://) is trusted', () => {
    const sender: TrustedSender = {
      frameUrl: 'file:///Applications/recompose.app/renderer/index.html',
      isMainFrame: true,
    };

    expect(() => {
      assertTrustedSender(sender, noDevOrigin);
    }).not.toThrow();
  });

  test('the dev server main frame is trusted when its origin is allowed', () => {
    const sender: TrustedSender = { frameUrl: 'http://localhost:5173/', isMainFrame: true };

    expect(() => {
      assertTrustedSender(sender, devOrigins);
    }).not.toThrow();
  });
});

describe('sender trust: rejected senders', () => {
  test('a foreign https origin is rejected', () => {
    const sender: TrustedSender = { frameUrl: 'https://evil.example.com', isMainFrame: true };

    expect(() => {
      assertTrustedSender(sender, devOrigins);
    }).toThrow();
  });

  test('a disposed frame (null senderFrame) is rejected', () => {
    const sender: TrustedSender = { frameUrl: null, isMainFrame: false };

    expect(() => {
      assertTrustedSender(sender, devOrigins);
    }).toThrow();
  });

  test('a non-main frame at an otherwise trusted origin is rejected', () => {
    const sender: TrustedSender = { frameUrl: 'http://localhost:5173/', isMainFrame: false };

    expect(() => {
      assertTrustedSender(sender, devOrigins);
    }).toThrow();
  });

  test('the dev server origin is untrusted when no dev origin is configured', () => {
    const sender: TrustedSender = { frameUrl: 'http://localhost:5173/', isMainFrame: true };

    expect(() => {
      assertTrustedSender(sender, noDevOrigin);
    }).toThrow();
  });
});
