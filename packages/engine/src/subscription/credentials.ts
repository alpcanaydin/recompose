import type { SubscriptionProviderId } from '@recompose/contracts';

import { isJsonObject } from '../gateway-wire';
import { claudeCredentialFields } from './claude-credential-fields';
import { firstNonBlankCredentialValue, nonBlankCredentialValue } from './credential-values';

export type ParsedSubscriptionCredential = {
  accessToken: string;
  refreshToken?: string;
  accountId?: string;
  planType?: string;
  accountUuid?: string;
  deviceIds?: string[];
  expiresAt?: number;
  projectId?: string;
  timezone?: string;
  deviceMigrationNeeded?: boolean;
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

function jwtClaims(token: string): JsonObject | null {
  const encoded = token.split('.')[1];

  if (encoded === undefined) return null;

  try {
    return objectOf(JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')));
  } catch {
    return null;
  }
}

function jwtExpiry(token: string): number | undefined {
  const expiry = finiteNumber(jwtClaims(token)?.['exp']);

  return expiry === undefined ? undefined : expiry * 1000;
}

function codexPlanType(token: string): string | undefined {
  const auth = objectOf(jwtClaims(token)?.['https://api.openai.com/auth']);

  return nonBlankCredentialValue(auth?.['chatgpt_plan_type']);
}

function codexCredentialFields(accessToken: string, tokens: JsonObject) {
  const refreshToken = nonBlankCredentialValue(tokens['refresh_token']);
  const accountId = nonBlankCredentialValue(tokens['account_id']);
  const expiresAt = jwtExpiry(accessToken);
  const planType = codexPlanType(accessToken);

  return {
    ...(refreshToken === undefined ? {} : { refreshToken }),
    ...(accountId === undefined ? {} : { accountId }),
    ...(planType === undefined ? {} : { planType }),
    ...(expiresAt === undefined ? {} : { expiresAt }),
  };
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function claudeCredential(
  document: JsonObject,
  tokens: JsonObject,
): ParsedSubscriptionCredential | null {
  const accessToken = nonBlankCredentialValue(tokens['accessToken']);

  if (accessToken === undefined) {
    return null;
  }

  const refreshToken = nonBlankCredentialValue(tokens['refreshToken']);
  const expiresAt = finiteNumber(tokens['expiresAt']);

  return {
    accessToken,
    ...(refreshToken === undefined ? {} : { refreshToken }),
    ...claudeCredentialFields(document, tokens),
    ...(expiresAt === undefined ? {} : { expiresAt }),
  };
}

function codexCredential(tokens: JsonObject): ParsedSubscriptionCredential | null {
  const accessToken = nonBlankCredentialValue(tokens['access_token']);

  if (accessToken === undefined) {
    return null;
  }

  return {
    accessToken,
    ...codexCredentialFields(accessToken, tokens),
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
  const accessToken = nonBlankCredentialValue(document['access_token']);

  if (accessToken === undefined) {
    return null;
  }

  const refreshToken = nonBlankCredentialValue(document['refresh_token']);
  const projectId = firstNonBlankCredentialValue(document['project_id'], document['projectId']);
  const expiresAt = parsedDate(document['expired']);

  if (projectId === undefined) {
    return null;
  }

  return {
    accessToken,
    ...(refreshToken === undefined ? {} : { refreshToken }),
    projectId,
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
