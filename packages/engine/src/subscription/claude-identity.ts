import { randomBytes } from 'node:crypto';

import { isJsonObject } from '../gateway-wire';

type JsonObject = Record<string, unknown>;

export type ClaudeIdentity = {
  accountUuid: string;
  deviceId: string;
};

export function newClaudeDeviceId(): string {
  return randomBytes(32).toString('hex');
}

function existingUserId(body: JsonObject): JsonObject {
  const metadata = body['metadata'];

  if (!isJsonObject(metadata) || typeof metadata['user_id'] !== 'string') {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(metadata['user_id']);

    return isJsonObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function applyClaudeCredentialIdentity(
  rawBody: JsonObject,
  identity: ClaudeIdentity,
  sessionId: string,
): JsonObject {
  const body = structuredClone(rawBody);
  const metadata = isJsonObject(body['metadata']) ? body['metadata'] : {};
  const existing = existingUserId(body);
  const { device_id: _device, account_uuid: _account, session_id: _session, ...extras } = existing;
  const userId = {
    device_id: identity.deviceId,
    account_uuid: identity.accountUuid,
    session_id: sessionId,
    ...extras,
  };

  body['metadata'] = { ...metadata, user_id: JSON.stringify(userId) };

  return body;
}
