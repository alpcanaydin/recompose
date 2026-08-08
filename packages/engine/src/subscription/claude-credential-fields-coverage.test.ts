import { describe, expect, it } from 'vitest';

import { parseSubscriptionCredential } from './credentials';

function claudeCredentialFrom(deviceIds: unknown) {
  const credential = parseSubscriptionCredential(
    'anthropic',
    JSON.stringify({
      claude_device_ids: deviceIds,
      claudeAiOauth: { accessToken: 'token', refreshToken: 'refresh' },
    }),
  );

  if (credential === null) throw new Error('the test credential could not be read');

  return credential;
}

describe('a Claude credential whose stored device ids are unusable', () => {
  it('reads no device id from a list that holds none in the expected shape', () => {
    expect(claudeCredentialFrom(['not-a-device-id']).deviceIds).toBeUndefined();
  });

  it('reads no device id from an empty list', () => {
    expect(claudeCredentialFrom([]).deviceIds).toBeUndefined();
  });
});
