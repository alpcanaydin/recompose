import { describe, expect, test } from 'vitest';

import {
  aggregatorRow,
  gatewayHolding,
  keyRow,
  localRow,
  planRow,
  pointingAt,
  secret,
  storageHolding,
} from './spend-grant.testkit';
import { engineGatewayOf, storedEngineGateway } from './stored-gateway';

const noComplaint = (): void => undefined;

const thorough = {
  id: 'thorough',
  displayName: 'thorough',
  target: { accountId: aggregatorRow.id, providerModel: 'gpt-5' },
};

describe('what the engine hears about a stored gateway', () => {
  test('the snapshot carries the slug, the name, and the port the document holds', async () => {
    const userDataPath = await storageHolding([], []);

    await expect(storedEngineGateway(userDataPath, noComplaint, 'personal')).resolves.toMatchObject(
      { slug: 'personal', displayName: 'Personal', port: 8397 },
    );
  });

  test('a slug no stored document carries answers nothing', async () => {
    const userDataPath = await storageHolding([], []);

    await expect(storedEngineGateway(userDataPath, noComplaint, 'shared')).resolves.toBeUndefined();
  });

  test('a gateway that minted no virtual model carries an empty snapshot', async () => {
    const userDataPath = await storageHolding([], [keyRow]);
    const gateway = await storedEngineGateway(userDataPath, noComplaint, 'personal');

    expect(gateway?.virtualModels).toStrictEqual([]);
  });
});

describe('the standing each virtual model is minted with', () => {
  test('a target the registry still holds stands bound to the real model name', async () => {
    const userDataPath = await storageHolding([pointingAt(keyRow.id)], [keyRow]);
    const gateway = await storedEngineGateway(userDataPath, noComplaint, 'personal');

    expect(gateway?.virtualModels).toStrictEqual([
      {
        id: 'fast',
        displayName: 'fast',
        target: { standing: 'bound', providerModel: 'claude-sonnet-5' },
      },
    ]);
  });

  test('a local target the registry still holds stands bound', async () => {
    const userDataPath = await storageHolding([pointingAt(localRow.id)], [localRow]);
    const gateway = await storedEngineGateway(userDataPath, noComplaint, 'personal');

    expect(gateway?.virtualModels).toStrictEqual([
      {
        id: 'fast',
        displayName: 'fast',
        target: { standing: 'bound', providerModel: 'claude-sonnet-5' },
      },
    ]);
  });

  test('the snapshot never carries a credential', async () => {
    const userDataPath = await storageHolding([pointingAt(keyRow.id)], [keyRow]);
    const gateway = await storedEngineGateway(userDataPath, noComplaint, 'personal');

    expect(JSON.stringify(gateway)).not.toContain(secret);
  });
});

describe('a virtual model whose target no longer stands', () => {
  test('a target the registry no longer holds stands removed, naming no model', async () => {
    const userDataPath = await storageHolding([pointingAt(keyRow.id)], []);
    const gateway = await storedEngineGateway(userDataPath, noComplaint, 'personal');

    expect(gateway?.virtualModels).toStrictEqual([
      { id: 'fast', displayName: 'fast', target: { standing: 'removed' } },
    ]);
  });

  test('a target that turned out to be a subscription stands removed', async () => {
    const userDataPath = await storageHolding([pointingAt(planRow.id)], [planRow]);
    const gateway = await storedEngineGateway(userDataPath, noComplaint, 'personal');

    expect(gateway?.virtualModels).toStrictEqual([
      { id: 'fast', displayName: 'fast', target: { standing: 'removed' } },
    ]);
  });

  test('each virtual model is minted with its own standing', async () => {
    const userDataPath = await storageHolding([pointingAt(keyRow.id), thorough], [aggregatorRow]);
    const gateway = await storedEngineGateway(userDataPath, noComplaint, 'personal');

    expect(gateway?.virtualModels).toStrictEqual([
      { id: 'fast', displayName: 'fast', target: { standing: 'removed' } },
      {
        id: 'thorough',
        displayName: 'thorough',
        target: { standing: 'bound', providerModel: 'gpt-5' },
      },
    ]);
  });
});

describe('the snapshot a gateway about to be written serves under', () => {
  test('a config in hand resolves against the registry without being read back', async () => {
    const userDataPath = await storageHolding([], [keyRow]);
    const moving = { ...gatewayHolding([pointingAt(keyRow.id)]), port: 51234 };

    await expect(engineGatewayOf(userDataPath, noComplaint, moving)).resolves.toStrictEqual({
      slug: 'personal',
      displayName: 'Personal',
      port: 51234,
      virtualModels: [
        {
          id: 'fast',
          displayName: 'fast',
          target: { standing: 'bound', providerModel: 'claude-sonnet-5' },
        },
      ],
    });
  });
});
