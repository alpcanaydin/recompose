type JsonObject = Record<string, unknown>;

import { firstNonBlankCredentialValue } from './credential-values';

function validDeviceIds(value: unknown): { deviceIds?: string[]; deviceMigrationNeeded?: boolean } {
  if (!Array.isArray(value)) return {};

  const ids = value.filter(
    (item): item is string => typeof item === 'string' && /^[a-f\d]{64}$/u.test(item),
  );
  const first = ids[0];

  return first === undefined
    ? {}
    : { deviceIds: [first], ...(ids.length === 5 ? { deviceMigrationNeeded: true } : {}) };
}

export function claudeCredentialFields(document: JsonObject, tokens: JsonObject) {
  const accountUuid = firstNonBlankCredentialValue(
    document['account_uuid'],
    document['accountUuid'],
    tokens['account_uuid'],
    tokens['accountUuid'],
  );
  const candidates = [document['claude_device_ids'], tokens['claude_device_ids']];
  const device =
    candidates.map(validDeviceIds).find((value) => value.deviceIds !== undefined) ?? {};
  const timezone = firstNonBlankCredentialValue(document['timezone'], tokens['timezone']);

  return {
    ...(accountUuid === undefined ? {} : { accountUuid }),
    ...device,
    ...(timezone === undefined ? {} : { timezone }),
  };
}
