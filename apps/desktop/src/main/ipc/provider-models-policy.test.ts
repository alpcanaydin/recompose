import type { ModelListing } from '@recompose/contracts';

import { ACCOUNTS_VERSION } from '@recompose/contracts';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { ProviderModelsIpcContext } from './provider-models-ipc';

import { contextFor, keyRow, storageHolding } from '../engine-host/spend-grant.testkit';
import { createProviderModelsIpcHandlers } from './provider-models-ipc';

describe('provider model policy at the account model-list boundary', () => {
  test('excluded models are filtered case-insensitively without applying router aliases', async () => {
    const userDataPath = await storageHolding([], [keyRow]);

    await writePolicy(userDataPath, [' MODEL-B ', 'model-c']);
    const listing: ModelListing = {
      standing: 'listed',
      modelIds: ['model-a', 'model-b', 'MODEL-C'],
    };
    const handlers = createProviderModelsIpcHandlers(contextListing(userDataPath, listing));

    await expect(handlers['accounts:list-models']({ id: keyRow.id })).resolves.toEqual({
      ok: true,
      value: { standing: 'listed', modelIds: ['model-a'] },
    });
  });

  test('filtering every model preserves the listed-empty distinction', async () => {
    const userDataPath = await storageHolding([], [keyRow]);

    await writePolicy(userDataPath, ['model-a']);
    const handlers = createProviderModelsIpcHandlers(
      contextListing(userDataPath, { standing: 'listed', modelIds: ['model-a'] }),
    );

    await expect(handlers['accounts:list-models']({ id: keyRow.id })).resolves.toEqual({
      ok: true,
      value: { standing: 'listed', modelIds: [] },
    });
  });
});

function contextListing(userDataPath: string, listing: ModelListing): ProviderModelsIpcContext {
  return {
    ...contextFor(userDataPath),
    listModels: async () => Promise.resolve(listing),
  };
}

async function writePolicy(userDataPath: string, excludedModels: readonly string[]): Promise<void> {
  await writeFile(
    join(userDataPath, 'accounts.json'),
    JSON.stringify({
      schemaVersion: ACCOUNTS_VERSION,
      accounts: [keyRow],
      modelPolicies: {
        Anthropic: {
          excludedModels,
          aliases: [{ name: 'model-a', alias: 'friendly', displayName: 'Friendly' }],
        },
      },
    }),
    'utf8',
  );
}
