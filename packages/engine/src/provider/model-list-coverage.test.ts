import { describe, expect, test } from 'vitest';

import { listProviderModels } from './model-list';

const neverFetches: typeof fetch = async () => {
  await Promise.resolve();

  throw new Error('no network look expected');
};

function answering(payload: unknown, status = 200): typeof fetch {
  return async () => {
    await Promise.resolve();

    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
}

function codexSubscription(credential: string) {
  return {
    custody: 'subscription' as const,
    provider: 'openai' as const,
    accountId: 'acc-codex',
    credential,
  };
}

function tokenFor(claims: unknown): string {
  return `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;
}

describe('a Codex subscription is listed by the plan its credential names', () => {
  test('a credential that is not JSON lists the paid catalog', async () => {
    const listing = await listProviderModels(neverFetches, 'https://api.openai.com', {
      ...codexSubscription('not json'),
    });

    expect(listing.standing).toBe('listed');
  });

  test('a credential without a token record lists the paid catalog', async () => {
    const listing = await listProviderModels(
      neverFetches,
      'https://api.openai.com',
      codexSubscription('{"tokens":"opaque"}'),
    );

    expect(listing.standing).toBe('listed');
  });

  test('a token record without an identity token lists the paid catalog', async () => {
    const listing = await listProviderModels(
      neverFetches,
      'https://api.openai.com',
      codexSubscription('{"tokens":{"access_token":"oauth"}}'),
    );

    expect(listing.standing).toBe('listed');
  });
});

describe('a Codex identity token the gateway cannot read lists the paid catalog', () => {
  test('an identity token with no claims section lists the paid catalog', async () => {
    const credential = JSON.stringify({ tokens: { id_token: 'opaque' } });
    const listing = await listProviderModels(
      neverFetches,
      'https://api.openai.com',
      codexSubscription(credential),
    );

    expect(listing.standing).toBe('listed');
  });

  test('claims the gateway cannot read list the paid catalog', async () => {
    const credential = JSON.stringify({ tokens: { id_token: 'header.notbase64json.signature' } });
    const listing = await listProviderModels(
      neverFetches,
      'https://api.openai.com',
      codexSubscription(credential),
    );

    expect(listing.standing).toBe('listed');
  });

  test('claims without an authorization section list the paid catalog', async () => {
    const credential = JSON.stringify({ tokens: { id_token: tokenFor({ sub: 'user' }) } });
    const listing = await listProviderModels(
      neverFetches,
      'https://api.openai.com',
      codexSubscription(credential),
    );

    expect(listing.standing).toBe('listed');
  });

  test('a plan that is not a word lists the paid catalog', async () => {
    const claims = { 'https://api.openai.com/auth': { chatgpt_plan_type: 7 } };
    const listing = await listProviderModels(
      neverFetches,
      'https://api.openai.com',
      codexSubscription(JSON.stringify({ tokens: { id_token: tokenFor(claims) } })),
    );

    expect(listing.standing).toBe('listed');
  });
});

const credentialed = {
  custody: 'provider-key' as const,
  provider: 'openai' as const,
  credential: 'sk-test',
};

describe('a credentialed catalog is read from whichever shape the provider sent', () => {
  test('a catalog under a data list is read', async () => {
    const listing = await listProviderModels(
      answering({ data: [{ id: 'gpt-5' }] }),
      'https://api.openai.com',
      credentialed,
    );

    expect(listing).toEqual({ standing: 'listed', modelIds: ['gpt-5'] });
  });

  test('a catalog under a models list is read', async () => {
    const listing = await listProviderModels(
      answering({ models: [{ name: 'models/gemini-3.6-flash' }] }),
      'https://generativelanguage.googleapis.com',
      credentialed,
    );

    expect(listing).toEqual({ standing: 'listed', modelIds: ['gemini-3.6-flash'] });
  });

  test('a body that is not an object is not a catalog', async () => {
    const listing = await listProviderModels(
      answering('gpt-5'),
      'https://api.openai.com',
      credentialed,
    );

    expect(listing.standing).not.toBe('listed');
  });

  test('a body with neither list is not a catalog', async () => {
    const listing = await listProviderModels(
      answering({ object: 'list' }),
      'https://api.openai.com',
      credentialed,
    );

    expect(listing.standing).not.toBe('listed');
  });

  test('a data field that is not a list is not a catalog', async () => {
    const listing = await listProviderModels(
      answering({ data: 'gpt-5' }),
      'https://api.openai.com',
      credentialed,
    );

    expect(listing.standing).not.toBe('listed');
  });

  test('an entry without a readable identifier voids the whole catalog', async () => {
    const listing = await listProviderModels(
      answering({ data: [{ id: 'gpt-5' }, { object: 'model' }] }),
      'https://api.openai.com',
      credentialed,
    );

    expect(listing.standing).not.toBe('listed');
  });
});
