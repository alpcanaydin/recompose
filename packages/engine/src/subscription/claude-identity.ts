import { randomBytes } from 'node:crypto';

import { InvalidJsonBodyError, isJsonObject } from '../gateway-wire';
import { duplicateJsonKey } from '../json-duplicates';

type JsonObject = Record<string, unknown>;

export type ClaudeIdentity = {
  accountUuid: string;
  deviceId: string;
};

export function newClaudeDeviceId(): string {
  return randomBytes(32).toString('hex');
}

function encodedUserId(body: JsonObject): string | undefined {
  const metadata = body['metadata'];

  return isJsonObject(metadata) && typeof metadata['user_id'] === 'string'
    ? metadata['user_id']
    : undefined;
}

function existingUserId(body: JsonObject): JsonObject {
  const encoded = encodedUserId(body);

  if (encoded === undefined) {
    return {};
  }

  const duplicate = duplicateJsonKey(encoded);

  if (duplicate !== undefined) {
    throw new InvalidJsonBodyError(
      `The request metadata user_id repeats the JSON key "${duplicate}".`,
    );
  }

  try {
    const parsed: unknown = JSON.parse(encoded);

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
