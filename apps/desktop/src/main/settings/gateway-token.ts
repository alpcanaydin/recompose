import type { GatewayTokenStatus } from '@recompose/contracts';

import { randomBytes } from 'node:crypto';

export const GATEWAY_TOKEN_REF = 'gateway-token';

export function gatewayTokenStorageState(
  encryptionAvailable: boolean,
  plaintextFallback: boolean,
): GatewayTokenStatus['storage'] {
  if (!encryptionAvailable) {
    return 'unavailable';
  }

  return plaintextFallback ? 'plaintext-fallback' : 'available';
}

const TOKEN_PREFIX = 'rc-local-';
const TOKEN_ENTROPY_BYTES = 32;
const MASK_BULLETS = '••••••••';
const MASK_REVEALED_TAIL = 4;

export function mintGatewayToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(TOKEN_ENTROPY_BYTES).toString('base64url')}`;
}

export function maskGatewayToken(token: string): string {
  return `${TOKEN_PREFIX}${MASK_BULLETS}${token.slice(-MASK_REVEALED_TAIL)}`;
}
