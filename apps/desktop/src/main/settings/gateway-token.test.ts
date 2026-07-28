import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import {
  GATEWAY_TOKEN_REF,
  gatewayTokenStorageState,
  maskGatewayToken,
  mintGatewayToken,
} from './gateway-token';

const tokenBody = fc.string({
  minLength: 5,
  maxLength: 64,
  unit: fc.constantFrom(
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'.split(''),
  ),
});

function windowsOf(body: string, size: number): string[] {
  return Array.from({ length: Math.max(body.length - size + 1, 0) }, (_, start) =>
    body.slice(start, start + size),
  );
}

describe('minting a gateway token', () => {
  test('a minted token announces itself as local and carries 32 random bytes', () => {
    const token = mintGatewayToken();
    const body = token.slice('rc-local-'.length);

    expect(token.startsWith('rc-local-')).toBe(true);
    expect(Buffer.from(body, 'base64url')).toHaveLength(32);
    expect(body).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test('two mints never agree', () => {
    const mints = Array.from({ length: 32 }, () => mintGatewayToken());

    expect(new Set(mints).size).toBe(mints.length);
  });

  test('the vault reference the token lives under is fixed', () => {
    expect(GATEWAY_TOKEN_REF).toBe('gateway-token');
  });
});

describe('the credential store behind the gateway token', () => {
  test('an encrypting store is available', () => {
    expect(gatewayTokenStorageState(true, false)).toBe('available');
  });

  test('an encrypting store that falls back to plaintext says so', () => {
    expect(gatewayTokenStorageState(true, true)).toBe('plaintext-fallback');
  });

  test('a store that cannot encrypt is unavailable, whatever it falls back to', () => {
    expect(gatewayTokenStorageState(false, false)).toBe('unavailable');
    expect(gatewayTokenStorageState(false, true)).toBe('unavailable');
  });
});

describe('masking a gateway token', () => {
  test('the mask keeps the local prefix, eight bullets, and the last four characters', () => {
    expect(maskGatewayToken('rc-local-1234567890123456')).toBe('rc-local-••••••••3456');
  });

  test.prop([tokenBody])(
    'the masked body hides every five-character window of the token body',
    (body) => {
      const mask = maskGatewayToken(`rc-local-${body}`);
      const maskedBody = mask.slice('rc-local-'.length);

      expect(windowsOf(body, 5).some((window) => maskedBody.includes(window))).toBe(false);
    },
  );

  test.prop([tokenBody])('the mask reveals the last four characters and no more', (body) => {
    const mask = maskGatewayToken(`rc-local-${body}`);

    expect(mask).toBe(`rc-local-••••••••${body.slice(-4)}`);
  });
});
