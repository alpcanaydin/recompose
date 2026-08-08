import type { JsonObject } from '../gateway-wire';
import type { ClaudeDeviceProfile } from './claude-device-profile';
import type { ClaudePayloadPolicy } from './claude-payload-policy';
import type { ProviderRequest } from './claude-request';
import type { ClaudeSystemPolicy } from './claude-system-policy';
import type { ParsedSubscriptionCredential } from './credentials';

import { claudeProviderRequest } from './claude-request';
import { resolvedClaudeTimezone } from './claude-timezone';

type ClaudeReachOptions = {
  providerOrigin: string;
  body: JsonObject;
  credential: ParsedSubscriptionCredential;
  sessionId: string;
  requestId: string;
  now: number;
  configuredTimezone: string | undefined;
  systemPolicy: ClaudeSystemPolicy | undefined;
  payloadPolicy: ClaudePayloadPolicy | undefined;
  wireProfile: ClaudeDeviceProfile | undefined;
};

export function claudeReachRequest(options: ClaudeReachOptions): ProviderRequest {
  return claudeProviderRequest(
    options.providerOrigin,
    options.body,
    options.credential.accessToken,
    { sessionId: options.sessionId, requestId: options.requestId },
    claudeIdentityOf(options.credential),
    options.now,
    'messages',
    resolvedClaudeTimezone(options.credential.timezone, options.configuredTimezone),
    options.systemPolicy,
    options.payloadPolicy,
    options.wireProfile,
  );
}

function claudeIdentityOf(credential: ParsedSubscriptionCredential) {
  const deviceId = credential.deviceIds?.[0];

  return credential.accountUuid === undefined || deviceId === undefined
    ? undefined
    : { accountUuid: credential.accountUuid, deviceId };
}
