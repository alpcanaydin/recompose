import { expect, test } from 'vitest';

import { resolveSpendGrant } from './spend-grant';
import {
  contextFor,
  holdSubscriptionCredential,
  planRow,
  pointingAt,
  storageHolding,
} from './spend-grant.testkit';

test('a per-account direct policy reaches the engine without entering public views', async () => {
  const account = { ...planRow, transportPolicy: { mode: 'direct' } } as const;
  const userDataPath = await storageHolding([pointingAt(account.id)], [account]);

  await holdSubscriptionCredential(
    userDataPath,
    'anthropic',
    account.id,
    '{"claudeAiOauth":{"accessToken":"token"}}',
  );

  await expect(
    resolveSpendGrant(contextFor(userDataPath), 'personal', 'fast'),
  ).resolves.toMatchObject({
    spend: { custody: 'subscription', transportPolicy: { mode: 'direct' } },
  });
});
