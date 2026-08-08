import type { LookCustody, ModelListing } from '@recompose/contracts';

import { ACCOUNTS_VERSION } from '@recompose/contracts';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { ProviderModelsIpcContext } from './provider-models-ipc';

import {
  aggregatorRow,
  contextFor,
  holdSubscriptionCredential,
  keyRow,
  localRow,
  planRow,
  rewriteVault,
  secret,
  storageHolding,
} from '../engine-host/spend-grant.testkit';
import { createProviderModelsIpcHandlers, providerModelsReach } from './provider-models-ipc';

type Look = { origin: string; custody: LookCustody };

const gpt5: ModelListing = { standing: 'listed', modelIds: ['gpt-5'] };

function deskOver(userDataPath: string, listing: ModelListing = gpt5) {
  const looks: Look[] = [];
  const ctx: ProviderModelsIpcContext = {
    ...contextFor(userDataPath),
    listModels: async (origin, custody) => {
      looks.push({ origin, custody });

      return Promise.resolve(listing);
    },
  };

  return { looks, handlers: createProviderModelsIpcHandlers(ctx) };
}

describe('the account a look resolves against', () => {
  test('a first-party key is read at its vendor endpoint under that vendor own header', async () => {
    const { looks, handlers } = deskOver(await storageHolding([], [keyRow]));

    const answer = await handlers['accounts:list-models']({ id: keyRow.id });

    expect(answer).toEqual({ ok: true, value: gpt5 });
    expect(looks).toEqual([
      {
        origin: 'https://api.anthropic.com',
        custody: { custody: 'provider-key', provider: 'anthropic', credential: secret },
      },
    ]);
  });

  test('an aggregator is read at its own endpoint, as a bearer of its stored secret', async () => {
    const { looks, handlers } = deskOver(await storageHolding([], [aggregatorRow]));

    await handlers['accounts:list-models']({ id: aggregatorRow.id });

    expect(looks).toEqual([
      {
        origin: 'https://openrouter.ai/api',
        custody: { custody: 'bearer', provider: 'openrouter', credential: secret },
      },
    ]);
  });

  test('a local runtime is read at the address its row was stored with, and openly', async () => {
    const { looks, handlers } = deskOver(await storageHolding([], [localRow]));

    await handlers['accounts:list-models']({ id: localRow.id });

    expect(looks).toEqual([{ origin: 'http://127.0.0.1:11434', custody: { custody: 'open' } }]);
  });
});

describe('an account no look can stand on', () => {
  test('a subscription lists through its complete native credential document', async () => {
    const userDataPath = await storageHolding([], [planRow]);
    const credential = '{"claudeAiOauth":{"accessToken":"oauth-token"}}';

    await holdSubscriptionCredential(userDataPath, 'anthropic', planRow.id, credential);

    const { looks, handlers } = deskOver(userDataPath);

    const answer = await handlers['accounts:list-models']({ id: planRow.id });

    expect(answer).toEqual({ ok: true, value: gpt5 });
    expect(looks).toEqual([
      {
        origin: 'https://api.anthropic.com',
        custody: {
          custody: 'subscription',
          provider: 'anthropic',
          accountId: planRow.id,
          credential,
        },
      },
    ]);
  });

  test('an id the registry never held answers unlisted, and asks the engine nothing', async () => {
    const { looks, handlers } = deskOver(await storageHolding([], [keyRow]));

    const answer = await handlers['accounts:list-models']({ id: 'acc-ghost' });

    expect(answer).toEqual({ ok: true, value: { standing: 'unlisted' } });
    expect(looks).toEqual([]);
  });

  test('a key whose secret the vault lost answers unlisted rather than an open look', async () => {
    const userDataPath = await storageHolding([], [keyRow]);

    await rewriteVault(userDataPath, {});

    const { looks, handlers } = deskOver(userDataPath);
    const answer = await handlers['accounts:list-models']({ id: keyRow.id });

    expect(answer).toEqual({ ok: true, value: { standing: 'unlisted' } });
    expect(looks).toEqual([]);
  });

  test('a provider recompose serves nothing for answers unlisted', async () => {
    const stranger = { ...keyRow, id: 'acc-stranger', provider: 'cohere' } as const;
    const { looks, handlers } = deskOver(await storageHolding([], [stranger]));

    const answer = await handlers['accounts:list-models']({ id: stranger.id });

    expect(answer).toEqual({ ok: true, value: { standing: 'unlisted' } });
    expect(looks).toEqual([]);
  });
});

describe('what the look answers with', () => {
  test('a provider that read nothing travels back as the unlisted answer', async () => {
    const { handlers } = deskOver(await storageHolding([], [keyRow]), {
      standing: 'unlisted',
    });

    await expect(handlers['accounts:list-models']({ id: keyRow.id })).resolves.toEqual({
      ok: true,
      value: { standing: 'unlisted' },
    });
  });

  test('a registry a newer build wrote refuses rather than reading as an empty account', async () => {
    const userDataPath = await storageHolding([], [keyRow]);

    await writeFile(
      join(userDataPath, 'accounts.json'),
      JSON.stringify({ schemaVersion: ACCOUNTS_VERSION + 1, accounts: [] }),
      'utf8',
    );

    const { looks, handlers } = deskOver(userDataPath);
    const answer = await handlers['accounts:list-models']({ id: keyRow.id });

    expect(answer).toMatchObject({ ok: false, error: { code: 'accounts-newer-schema' } });
    expect(looks).toEqual([]);
  });

  test('an account the registry never held reads as unlisted rather than a storage failure', async () => {
    const { handlers } = deskOver(await storageHolding([], []));

    await expect(handlers['accounts:list-models']({ id: keyRow.id })).resolves.toEqual({
      ok: true,
      value: { standing: 'unlisted' },
    });
  });
});

describe('the desk the look runs on', () => {
  test('the origin and the custody travel to the engine that does the reading', async () => {
    const asked: Look[] = [];
    const engine = {
      listModels: async (origin: string, custody: LookCustody) => {
        asked.push({ origin, custody });

        return Promise.resolve(gpt5);
      },
    };
    const ctx = providerModelsReach(contextFor(await storageHolding([], [localRow])), engine);

    const answer = await createProviderModelsIpcHandlers(ctx)['accounts:list-models']({
      id: localRow.id,
    });

    expect(answer).toEqual({ ok: true, value: gpt5 });
    expect(asked).toEqual([{ origin: 'http://127.0.0.1:11434', custody: { custody: 'open' } }]);
  });
});

describe('what a look leaves behind', () => {
  test('no answer on this channel carries the secret it was resolved with', async () => {
    const { handlers } = deskOver(await storageHolding([], [keyRow]));

    const answer = await handlers['accounts:list-models']({ id: keyRow.id });

    expect(JSON.stringify(answer)).not.toContain(secret);
  });

  test('the secret reaches the engine argument and nothing else about the process', async () => {
    const { looks, handlers } = deskOver(await storageHolding([], [keyRow]));

    await handlers['accounts:list-models']({ id: keyRow.id });

    expect(JSON.stringify(looks)).toContain(secret);
    expect(process.argv.join(' ')).not.toContain(secret);
    expect(JSON.stringify(process.env)).not.toContain(secret);
  });
});
