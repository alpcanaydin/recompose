import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { resolveSpendGrant } from './spend-grant';
import {
  contextFor,
  keyRow,
  pointingAt,
  rewriteRegistry,
  rewriteVault,
  secret,
  storageHolding,
} from './spend-grant.testkit';

async function grantedOver(userDataPath: string) {
  return resolveSpendGrant(contextFor(userDataPath), 'personal', 'fast');
}

describe('where the credential a grant carries is allowed to live', () => {
  test('the registry holds no credential after a grant resolves', async () => {
    const userDataPath = await storageHolding([pointingAt(keyRow.id)], [keyRow]);

    await grantedOver(userDataPath);

    const registry = await readFile(join(userDataPath, 'accounts.json'), 'utf8');

    expect(registry).not.toContain(secret);
  });

  test('the gateway document holds no credential after a grant resolves', async () => {
    const userDataPath = await storageHolding([pointingAt(keyRow.id)], [keyRow]);

    await grantedOver(userDataPath);

    const document = await readFile(join(userDataPath, 'gateways', 'personal.json'), 'utf8');

    expect(document).not.toContain(secret);
  });

  test('the vault stands as it was written, encrypted, after a grant resolves', async () => {
    const userDataPath = await storageHolding([pointingAt(keyRow.id)], [keyRow]);
    const before = await readFile(join(userDataPath, 'vault.bin'), 'utf8');

    await grantedOver(userDataPath);

    const after = await readFile(join(userDataPath, 'vault.bin'), 'utf8');

    expect(after).toBe(before);
    expect(after).not.toContain(secret);
  });

  test('this process carries no credential in its environment after a grant resolves', async () => {
    const userDataPath = await storageHolding([pointingAt(keyRow.id)], [keyRow]);

    await grantedOver(userDataPath);

    expect(Object.values(process.env)).not.toContain(secret);
    expect(process.argv).not.toContain(secret);
  });

  test('a request after the key was replaced grants the secret the vault holds now', async () => {
    const userDataPath = await storageHolding([pointingAt(keyRow.id)], [keyRow]);
    const first = await grantedOver(userDataPath);

    await rewriteVault(userDataPath, { 'cred-key': 'sk-ant-api03-rotated-9d1f' });

    const second = await grantedOver(userDataPath);

    expect(first).toMatchObject({ spend: { credential: secret } });
    expect(second).toMatchObject({ spend: { credential: 'sk-ant-api03-rotated-9d1f' } });
  });

  test('a request after the target account was removed answers a missing target', async () => {
    const userDataPath = await storageHolding([pointingAt(keyRow.id)], [keyRow]);
    const first = await grantedOver(userDataPath);

    await rewriteRegistry(userDataPath, []);

    expect(first).toMatchObject({ verdict: 'resolved' });
    await expect(grantedOver(userDataPath)).resolves.toStrictEqual({ verdict: 'missing-target' });
  });
});
