import type { SubscriptionProviderId } from '@recompose/contracts';

import { isJsonObject } from '../gateway-wire';

export type ParsedSubscriptionCredential = {
  accessToken: string;
  refreshToken?: string;
  accountId?: string;
  accountUuid?: string;
  deviceIds?: string[];
  expiresAt?: number;
  projectId?: string;
};

export type RefreshedTokens = {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresInSeconds: number;
};

type JsonObject = Record<string, unknown>;

function objectOf(value: unknown): JsonObject | null {
  return isJsonObject(value) ? value : null;
}

function documentOf(blob: string): JsonObject | null {
  try {
    return objectOf(JSON.parse(blob));
  } catch {
    return null;
  }
}

function nonBlank(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function firstNonBlank(...values: unknown[]): string | undefined {
  return values.map(nonBlank).find((value) => value !== undefined);
}

function jwtExpiry(token: string): number | undefined {
  const encoded = token.split('.')[1];

  if (encoded === undefined) {
    return undefined;
  }

  try {
    const claims = objectOf(JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')));
    const expiry = finiteNumber(claims?.['exp']);

    return expiry === undefined ? undefined : expiry * 1000;
  } catch {
    return undefined;
  }
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function validDeviceIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const ids = value.filter(
    (item): item is string => typeof item === 'string' && /^[a-f\d]{64}$/u.test(item),
  );
  const first = ids[0];

  return first === undefined ? undefined : [first];
}

function claudeIdentityFields(document: JsonObject, tokens: JsonObject) {
  const accountUuid = firstNonBlank(
    document['account_uuid'],
    document['accountUuid'],
    tokens['account_uuid'],
    tokens['accountUuid'],
  );
  const candidates = [document['claude_device_ids'], tokens['claude_device_ids']];
  const deviceIds = candidates.map(validDeviceIds).find((value) => value !== undefined);

  return {
    ...(accountUuid === undefined ? {} : { accountUuid }),
    ...(deviceIds === undefined ? {} : { deviceIds }),
  };
}

function claudeCredential(
  document: JsonObject,
  tokens: JsonObject,
): ParsedSubscriptionCredential | null {
  const accessToken = nonBlank(tokens['accessToken']);

  if (accessToken === undefined) {
    return null;
  }

  const refreshToken = nonBlank(tokens['refreshToken']);
  const expiresAt = finiteNumber(tokens['expiresAt']);

  return {
    accessToken,
    ...(refreshToken === undefined ? {} : { refreshToken }),
    ...claudeIdentityFields(document, tokens),
    ...(expiresAt === undefined ? {} : { expiresAt }),
  };
}

function codexCredential(tokens: JsonObject): ParsedSubscriptionCredential | null {
  const accessToken = nonBlank(tokens['access_token']);

  if (accessToken === undefined) {
    return null;
  }

  const refreshToken = nonBlank(tokens['refresh_token']);
  const accountId = nonBlank(tokens['account_id']);
  const expiresAt = jwtExpiry(accessToken);

  return {
    accessToken,
    ...(refreshToken === undefined ? {} : { refreshToken }),
    ...(accountId === undefined ? {} : { accountId }),
    ...(expiresAt === undefined ? {} : { expiresAt }),
  };
}

function parsedDate(value: unknown): number | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const parsed = Date.parse(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function antigravityCredential(document: JsonObject): ParsedSubscriptionCredential | null {
  const accessToken = nonBlank(document['access_token']);

  if (accessToken === undefined) {
    return null;
  }

  const refreshToken = nonBlank(document['refresh_token']);
  const projectId = firstNonBlank(document['project_id'], document['projectId']);
  const expiresAt = parsedDate(document['expired']);

  return {
    accessToken,
    ...(refreshToken === undefined ? {} : { refreshToken }),
    ...(projectId === undefined ? {} : { projectId }),
    ...(expiresAt === undefined ? {} : { expiresAt }),
  };
}

function nestedCredential(
  provider: Exclude<SubscriptionProviderId, 'antigravity'>,
  document: JsonObject,
): ParsedSubscriptionCredential | null {
  const tokens = objectOf(
    provider === 'anthropic' ? document['claudeAiOauth'] : document['tokens'],
  );

  if (tokens === null) {
    return null;
  }

  return provider === 'anthropic' ? claudeCredential(document, tokens) : codexCredential(tokens);
}

export function parseSubscriptionCredential(
  provider: SubscriptionProviderId,
  blob: string,
): ParsedSubscriptionCredential | null {
  const document = documentOf(blob);

  if (document === null) {
    return null;
  }

  if (provider === 'antigravity') {
    return antigravityCredential(document);
  }

  return nestedCredential(provider, document);
}

export function withClaudeCredentialIdentity(
  originalBlob: string,
  accountUuid: string,
  deviceId: string,
): string {
  const document = documentOf(originalBlob);

  if (document === null) {
    throw new Error('subscription credential document is malformed');
  }

  document['account_uuid'] = accountUuid;
  document['claude_device_ids'] = [deviceId];

  return JSON.stringify(document);
}

function refreshedClaudeDocument(
  document: JsonObject,
  refreshed: RefreshedTokens,
  now: number,
): void {
  const original = objectOf(document['claudeAiOauth']) ?? {};

  document['claudeAiOauth'] = {
    ...original,
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken ?? original['refreshToken'],
    expiresAt: now + refreshed.expiresInSeconds * 1000,
  };
}

function refreshedCodexDocument(
  document: JsonObject,
  refreshed: RefreshedTokens,
  now: number,
): void {
  const original = objectOf(document['tokens']) ?? {};

  document['tokens'] = {
    ...original,
    access_token: refreshed.accessToken,
    refresh_token: refreshed.refreshToken ?? original['refresh_token'],
    id_token: refreshed.idToken ?? original['id_token'],
  };
  document['last_refresh'] = new Date(now).toISOString();
}

function refreshedAntigravityDocument(
  document: JsonObject,
  refreshed: RefreshedTokens,
  now: number,
): void {
  document['access_token'] = refreshed.accessToken;
  document['refresh_token'] = refreshed.refreshToken ?? document['refresh_token'];
  document['expired'] = new Date(now + refreshed.expiresInSeconds * 1000).toISOString();
}

export function refreshedCredentialBlob(
  provider: SubscriptionProviderId,
  originalBlob: string,
  refreshed: RefreshedTokens,
  now: number,
): string {
  const document = documentOf(originalBlob);

  if (document === null) {
    throw new Error('subscription credential document is malformed');
  }

  if (provider === 'anthropic') {
    refreshedClaudeDocument(document, refreshed, now);
  } else if (provider === 'antigravity') {
    refreshedAntigravityDocument(document, refreshed, now);
  } else {
    refreshedCodexDocument(document, refreshed, now);
  }

  return JSON.stringify(document);
}
