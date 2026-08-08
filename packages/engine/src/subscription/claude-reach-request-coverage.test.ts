import { describe, expect, it } from 'vitest';

import { parsedJson } from '../gateway-wire';
import { claudeReachRequest } from './claude-reach-request';

describe('reaching Claude with a credential that names no device', () => {
  it('should send no account identity when the credential lists no device', () => {
    const request = claudeReachRequest({
      providerOrigin: 'https://api.anthropic.com',
      body: { model: 'claude-sonnet-4-5', messages: [{ role: 'user', content: 'hello' }] },
      credential: { accessToken: 'claude-access', accountUuid: 'aaaa-bbbb' },
      sessionId: '11111111-1111-4111-8111-111111111111',
      requestId: '22222222-2222-4222-8222-222222222222',
      now: 1_700_000_000_000,
      configuredTimezone: undefined,
      systemPolicy: undefined,
      payloadPolicy: undefined,
      wireProfile: undefined,
    });

    expect(JSON.stringify(parsedJson(request.body))).not.toContain('aaaa-bbbb');
  });
});
