import { describe, expect, it } from 'vitest';

import { isJsonObject } from '../gateway-wire';
import { applyClaudeCredentialIdentity, newClaudeDeviceId } from './claude-identity';

const identity = {
  deviceId: '0'.repeat(64),
  accountUuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
};

function metadataOf(body: Record<string, unknown>): Record<string, unknown> {
  const metadata = body['metadata'];

  if (!isJsonObject(metadata)) {
    throw new Error('expected metadata');
  }

  return metadata;
}

describe('Claude credential identity', () => {
  it('writes credential identity first and preserves non-identity metadata', () => {
    const body = applyClaudeCredentialIdentity(
      {
        messages: [],
        metadata: {
          trace: 'kept',
          user_id: JSON.stringify({
            device_id: 'f'.repeat(64),
            account_uuid: 'downstream-account',
            session_id: 'downstream-session',
            parent_session_id: 'parent-1',
            extra: true,
          }),
        },
      },
      identity,
      '11111111-2222-4333-8444-555555555555',
    );
    const metadata = metadataOf(body);

    expect(metadata['trace']).toBe('kept');
    expect(metadata['user_id']).toBe(
      '{"device_id":"0000000000000000000000000000000000000000000000000000000000000000",' +
        '"account_uuid":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",' +
        '"session_id":"11111111-2222-4333-8444-555555555555",' +
        '"parent_session_id":"parent-1","extra":true}',
    );
  });

  it.each([undefined, 'not json', '[]'])('replaces an unusable user id: %s', (userId) => {
    const body = applyClaudeCredentialIdentity(
      { metadata: userId === undefined ? {} : { user_id: userId } },
      identity,
      'session',
    );
    const metadata = metadataOf(body);

    expect(JSON.parse(String(metadata['user_id']))).toEqual({
      device_id: identity.deviceId,
      account_uuid: identity.accountUuid,
      session_id: 'session',
    });
  });

  it('generates a canonical 64-character lowercase device id', () => {
    expect(newClaudeDeviceId()).toMatch(/^[a-f\d]{64}$/u);
  });
});
