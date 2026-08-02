import type { SubscriptionProviderId } from '@recompose/contracts';

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export type SubscriptionObservation = {
  standing: 'connected' | 'lapsed';
  signedInAs?: string;
  plan?: string;
};

export type OutsideCredential = (() => Promise<boolean>) | null;

export type StandingRequest = {
  provider: SubscriptionProviderId;
  home: string;
  outsideCredential: OutsideCredential;
};

type Reading = {
  evidence: boolean;
  signedInAs: string | undefined;
  plan: string | undefined;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function recordAt(value: unknown, key: string): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }

  const found = value[key];

  return isRecord(found) ? found : null;
}

function spokenAt(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const found = value[key];
  const said = typeof found === 'string' ? found.trim() : '';

  return said === '' ? undefined : said;
}

async function recordIn(home: string, file: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(join(home, file), 'utf8'));
  } catch {
    return null;
  }
}

function planNamedByRateTier(tier: string | undefined): string | undefined {
  return tier?.match(/claude_(?<plan>max|pro|enterprise)/)?.groups?.['plan'];
}

async function readClaudeCode(home: string): Promise<Reading> {
  const [credential, identity] = await Promise.all([
    recordIn(home, '.credentials.json'),
    recordIn(home, '.claude.json'),
  ]);
  const oauth = recordAt(credential, 'claudeAiOauth');
  const account = recordAt(identity, 'oauthAccount');

  return {
    evidence: oauth !== null,
    signedInAs: spokenAt(account, 'emailAddress'),
    plan:
      spokenAt(oauth, 'subscriptionType') ??
      spokenAt(identity, 'subscriptionType') ??
      planNamedByRateTier(spokenAt(account, 'userRateLimitTier')),
  };
}

function sessionClaims(token: string | undefined): unknown {
  const payload = token?.split('.')[1];

  if (payload === undefined) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

async function readCodex(home: string): Promise<Reading> {
  const credential = await recordIn(home, 'auth.json');
  const session = recordAt(credential, 'tokens');
  const key = spokenAt(credential, 'OPENAI_API_KEY');
  const claims = sessionClaims(spokenAt(session, 'id_token'));

  return {
    evidence: session !== null || key !== undefined,
    signedInAs: spokenAt(claims, 'email'),
    plan: spokenAt(recordAt(claims, 'https://api.openai.com/auth'), 'chatgpt_plan_type'),
  };
}

async function keptOutsideTheHome(ask: OutsideCredential): Promise<boolean> {
  if (ask === null) {
    return false;
  }

  return ask().catch(() => false);
}

function onlyWhatTheRecordsSay(reading: Reading): Omit<SubscriptionObservation, 'standing'> {
  return {
    ...(reading.signedInAs === undefined ? {} : { signedInAs: reading.signedInAs }),
    ...(reading.plan === undefined ? {} : { plan: reading.plan }),
  };
}

export async function observeSubscription(
  request: StandingRequest,
): Promise<SubscriptionObservation> {
  const reading =
    request.provider === 'anthropic'
      ? await readClaudeCode(request.home)
      : await readCodex(request.home);

  const held = reading.evidence || (await keptOutsideTheHome(request.outsideCredential));

  return { standing: held ? 'connected' : 'lapsed', ...onlyWhatTheRecordsSay(reading) };
}
