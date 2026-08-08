import type { Account } from '@recompose/contracts';

import { ACCOUNTS_VERSION } from '@recompose/contracts';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import {
  contextFor,
  holdSubscriptionCredential,
  keyRow,
  localRow,
  planRow,
  storageHolding,
} from './spend-grant.testkit';
import { resolveTargetCustody } from './target-custody';

type StoredPolicies = Readonly<Record<string, { excludedModels: readonly string[] }>>;

const withoutModelB = { excludedModels: ['model-b'] };

async function registryHolding(
  accounts: readonly Account[],
  modelPolicies: StoredPolicies,
): Promise<string> {
  const userDataPath = await storageHolding([], accounts);

  await writeFile(
    join(userDataPath, 'accounts.json'),
    JSON.stringify({ schemaVersion: ACCOUNTS_VERSION, accounts, modelPolicies }),
    'utf8',
  );

  return userDataPath;
}

describe('a target account recompose reaches nothing for', () => {
  test('a key stored under a provider name outside the plugin alphabet answers a missing target', async () => {
    const outsideTheAlphabet = { ...keyRow, provider: '__proto__' };
    const userDataPath = await storageHolding([], [outsideTheAlphabet]);

    await expect(
      resolveTargetCustody(contextFor(userDataPath), outsideTheAlphabet.id),
    ).resolves.toStrictEqual({ verdict: 'missing-target' });
  });
});

describe('the model policy a resolved target carries', () => {
  test('a subscription target carries the policy stored for its provider', async () => {
    const credential = '{"claudeAiOauth":{"accessToken":"claude-access"}}';
    const userDataPath = await registryHolding([planRow], { anthropic: withoutModelB });

    await holdSubscriptionCredential(userDataPath, 'anthropic', planRow.id, credential);

    await expect(resolveTargetCustody(contextFor(userDataPath), planRow.id)).resolves.toStrictEqual(
      {
        verdict: 'resolved',
        providerOrigin: 'https://api.anthropic.com',
        custody: {
          custody: 'subscription',
          provider: 'anthropic',
          accountId: planRow.id,
          credential,
        },
        modelPolicy: withoutModelB,
      },
    );
  });

  test('a local runtime target carries the policy stored for its provider', async () => {
    const userDataPath = await registryHolding([localRow], { ollama: withoutModelB });

    await expect(
      resolveTargetCustody(contextFor(userDataPath), localRow.id),
    ).resolves.toStrictEqual({
      verdict: 'resolved',
      providerOrigin: 'http://127.0.0.1:11434',
      custody: { custody: 'open' },
      modelPolicy: withoutModelB,
    });
  });

  test('a local runtime target no policy names carries none', async () => {
    const userDataPath = await registryHolding([localRow], { anthropic: withoutModelB });

    await expect(
      resolveTargetCustody(contextFor(userDataPath), localRow.id),
    ).resolves.toStrictEqual({
      verdict: 'resolved',
      providerOrigin: 'http://127.0.0.1:11434',
      custody: { custody: 'open' },
    });
  });
});
