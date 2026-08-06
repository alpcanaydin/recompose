import type { SubscriptionProviderId } from '@recompose/contracts';

import { isJsonObject } from '../gateway-wire';

export type ParsedSubscriptionCredential = {
  accessToken: string;
  refreshToken?: string;
  accountId?: string;
  expiresAt?: number;
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

function claudeCredential(tokens: JsonObject): ParsedSubscriptionCredential | null {
  const accessToken = nonBlank(tokens['accessToken']);

  if (accessToken === undefined) {
    return null;
  }

  const refreshToken = nonBlank(tokens['refreshToken']);
  const expiresAt = finiteNumber(tokens['expiresAt']);

  return {
    accessToken,
    ...(refreshToken === undefined ? {} : { refreshToken }),
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

export function parseSubscriptionCredential(
  provider: SubscriptionProviderId,
  blob: string,
): ParsedSubscriptionCredential | null {
  const document = documentOf(blob);

  if (document === null) {
    return null;
  }

  const tokens = objectOf(
    provider === 'anthropic' ? document['claudeAiOauth'] : document['tokens'],
  );

  if (tokens === null) {
    return null;
  }

  return provider === 'anthropic' ? claudeCredential(tokens) : codexCredential(tokens);
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
  } else {
    refreshedCodexDocument(document, refreshed, now);
  }

  return JSON.stringify(document);
}
