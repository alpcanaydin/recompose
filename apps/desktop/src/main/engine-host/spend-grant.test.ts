import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { resolveSpendGrant } from './spend-grant';
import {
  aggregatorRow,
  codexPlanRow,
  contextFor,
  holdSubscriptionCredential,
  keyRow,
  localRow,
  planRow,
  pointingAt,
  secret,
  storageHolding,
} from './spend-grant.testkit';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('what a spend request draws for a credentialed target', () => {
  test('a key account grants its decrypted credential beside the vendor serving origin', async () => {
    const userDataPath = await storageHolding([pointingAt(keyRow.id)], [keyRow]);

    await expect(
      resolveSpendGrant(contextFor(userDataPath), 'personal', 'fast'),
    ).resolves.toStrictEqual({
      verdict: 'resolved',
      providerOrigin: 'https://api.anthropic.com',
      spend: { custody: 'credentialed', credential: secret },
    });
  });

  test('an aggregator account grants its credential beside the aggregator serving base', async () => {
    const userDataPath = await storageHolding([pointingAt(aggregatorRow.id)], [aggregatorRow]);

    await expect(
      resolveSpendGrant(contextFor(userDataPath), 'personal', 'fast'),
    ).resolves.toStrictEqual({
      verdict: 'resolved',
      providerOrigin: 'https://openrouter.ai/api',
      spend: { custody: 'credentialed', credential: secret },
    });
  });

  test('the grant carries the plain secret rather than what the vault stores', async () => {
    const userDataPath = await storageHolding([pointingAt(keyRow.id)], [keyRow], {
      'cred-key': 'sk-openai-another-secret-1a2b',
    });

    const grant = await resolveSpendGrant(contextFor(userDataPath), 'personal', 'fast');

    expect(JSON.stringify(grant)).toContain('sk-openai-another-secret-1a2b');
  });
});

describe('what a spend request draws for a local target', () => {
  test('a local account grants open custody against the address it was stored with', async () => {
    const userDataPath = await storageHolding([pointingAt(localRow.id)], [localRow], {});

    await expect(
      resolveSpendGrant(contextFor(userDataPath), 'personal', 'fast'),
    ).resolves.toStrictEqual({
      verdict: 'resolved',
      providerOrigin: 'http://127.0.0.1:11434',
      spend: { custody: 'open' },
    });
  });
});

describe('what a spend request draws for a subscription target', () => {
  test('a Claude subscription grants its complete live credential bundle', async () => {
    const credential = '{"claudeAiOauth":{"accessToken":"claude-access"}}';
    const userDataPath = await storageHolding([pointingAt(planRow.id)], [planRow]);

    await holdSubscriptionCredential(userDataPath, 'anthropic', planRow.id, credential);

    await expect(
      resolveSpendGrant(contextFor(userDataPath), 'personal', 'fast'),
    ).resolves.toStrictEqual({
      verdict: 'resolved',
      providerOrigin: 'https://api.anthropic.com',
      spend: {
        custody: 'subscription',
        provider: 'anthropic',
        accountId: planRow.id,
        credential,
      },
    });
  });

  test('a Codex subscription grants its complete live credential bundle', async () => {
    const credential = '{"tokens":{"access_token":"codex-access"}}';
    const userDataPath = await storageHolding(
      [pointingAt(codexPlanRow.id, 'gpt-5.4')],
      [codexPlanRow],
    );

    await holdSubscriptionCredential(userDataPath, 'openai', codexPlanRow.id, credential);

    await expect(
      resolveSpendGrant(contextFor(userDataPath), 'personal', 'fast'),
    ).resolves.toStrictEqual({
      verdict: 'resolved',
      providerOrigin: 'https://chatgpt.com/backend-api/codex',
      spend: {
        custody: 'subscription',
        provider: 'openai',
        accountId: codexPlanRow.id,
        credential,
      },
    });
  });

  test('a subscription whose credential disappeared answers a missing credential', async () => {
    const userDataPath = await storageHolding([pointingAt(planRow.id)], [planRow]);

    await expect(
      resolveSpendGrant(contextFor(userDataPath), 'personal', 'fast'),
    ).resolves.toStrictEqual({ verdict: 'missing-credential' });
  });
});

describe('what a spend request draws when no target stands', () => {
  test('a virtual model no stored gateway defines answers a missing target', async () => {
    const userDataPath = await storageHolding([pointingAt(keyRow.id)], [keyRow]);

    await expect(
      resolveSpendGrant(contextFor(userDataPath), 'personal', 'thorough'),
    ).resolves.toStrictEqual({ verdict: 'missing-target' });
  });

  test('a gateway slug nothing is stored under answers a missing target', async () => {
    const userDataPath = await storageHolding([pointingAt(keyRow.id)], [keyRow]);

    await expect(
      resolveSpendGrant(contextFor(userDataPath), 'shared', 'fast'),
    ).resolves.toStrictEqual({ verdict: 'missing-target' });
  });

  test('a target account the registry no longer holds answers a missing target', async () => {
    const userDataPath = await storageHolding([pointingAt(keyRow.id)], []);

    await expect(
      resolveSpendGrant(contextFor(userDataPath), 'personal', 'fast'),
    ).resolves.toStrictEqual({ verdict: 'missing-target' });
  });

  test('a key under a provider recompose serves nothing for answers a missing target', async () => {
    const stranger = { ...keyRow, provider: 'cerebras' };
    const userDataPath = await storageHolding([pointingAt(stranger.id)], [stranger]);

    await expect(
      resolveSpendGrant(contextFor(userDataPath), 'personal', 'fast'),
    ).resolves.toStrictEqual({ verdict: 'missing-target' });
  });

  test('a registry that cannot be read carries out rather than reading as a refusal', async () => {
    const userDataPath = await storageHolding([pointingAt(keyRow.id)], [keyRow]);

    await rm(join(userDataPath, 'accounts.json'));
    await mkdir(join(userDataPath, 'accounts.json'));

    await expect(resolveSpendGrant(contextFor(userDataPath), 'personal', 'fast')).rejects.toThrow();
  });
});

describe('which account a grant is resolved against', () => {
  test('the grant resolves the account the target names, not the first row held', async () => {
    const decoy = { ...localRow, id: 'acc-decoy' };
    const userDataPath = await storageHolding([pointingAt(keyRow.id)], [decoy, keyRow]);

    await expect(
      resolveSpendGrant(contextFor(userDataPath), 'personal', 'fast'),
    ).resolves.toMatchObject({ providerOrigin: 'https://api.anthropic.com' });
  });
});

describe('what a spend request draws when the credential is gone', () => {
  test('a key account whose vault entry is gone answers a missing credential', async () => {
    const userDataPath = await storageHolding([pointingAt(keyRow.id)], [keyRow], {});

    await expect(
      resolveSpendGrant(contextFor(userDataPath), 'personal', 'fast'),
    ).resolves.toStrictEqual({ verdict: 'missing-credential' });
  });

  test('a vault that cannot be read at all answers a missing credential', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const userDataPath = await storageHolding([pointingAt(keyRow.id)], [keyRow]);

    await rm(join(userDataPath, 'vault.bin'));
    await mkdir(join(userDataPath, 'vault.bin'));

    await expect(
      resolveSpendGrant(contextFor(userDataPath), 'personal', 'fast'),
    ).resolves.toStrictEqual({ verdict: 'missing-credential' });
  });

  test('a vault a newer build wrote answers a missing credential', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const userDataPath = await storageHolding([pointingAt(keyRow.id)], [keyRow]);

    await writeFile(
      join(userDataPath, 'vault.bin'),
      JSON.stringify({ schemaVersion: 2, entries: {} }),
      'utf8',
    );

    await expect(
      resolveSpendGrant(contextFor(userDataPath), 'personal', 'fast'),
    ).resolves.toStrictEqual({ verdict: 'missing-credential' });
  });
});

describe('how a vault that refuses the read is written down', () => {
  test('a vault the reader cannot open names what stopped it, and no secret', async () => {
    const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const userDataPath = await storageHolding([pointingAt(keyRow.id)], [keyRow]);

    await rm(join(userDataPath, 'vault.bin'));
    await mkdir(join(userDataPath, 'vault.bin'));

    await resolveSpendGrant(contextFor(userDataPath), 'personal', 'fast');

    const spoken = complaint.mock.calls.flat().map(String).join(' ');

    expect(spoken).toContain('vault');
    expect(spoken).toContain('EISDIR');
    expect(spoken).not.toContain(secret);
  });

  test('a vault a newer build wrote names the schema version it holds', async () => {
    const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const userDataPath = await storageHolding([pointingAt(keyRow.id)], [keyRow]);

    await writeFile(
      join(userDataPath, 'vault.bin'),
      JSON.stringify({ schemaVersion: 2, entries: {} }),
      'utf8',
    );

    await resolveSpendGrant(contextFor(userDataPath), 'personal', 'fast');

    const spoken = complaint.mock.calls.flat().map(String).join(' ');

    expect(spoken).toContain('vault');
    expect(spoken).toContain('schemaVersion 2');
  });

  test('a vault holding no entry for the account is refused without a complaint', async () => {
    const complaint = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const userDataPath = await storageHolding([pointingAt(keyRow.id)], [keyRow], {});

    await resolveSpendGrant(contextFor(userDataPath), 'personal', 'fast');

    expect(complaint).not.toHaveBeenCalled();
  });
});
