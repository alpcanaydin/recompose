import type { GatewayConfig } from '@recompose/contracts';

import { createHash } from 'node:crypto';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])]),
  );
}

export function gatewayConfigHash(config: GatewayConfig): string {
  return createHash('sha256')
    .update(JSON.stringify(stableValue(config)))
    .digest('hex');
}
