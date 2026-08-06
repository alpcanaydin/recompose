import type {
  Account,
  CredentialedAccount,
  GatewayConfig,
  LocalAccount,
  SubscriptionAccount,
  VirtualModel,
} from '@recompose/contracts';

import { ACCOUNTS_VERSION, GATEWAY_CONFIG_VERSION } from '@recompose/contracts';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { SecretCodec } from '../storage/safe-storage-codec';
import type { SpendGrantContext } from './spend-grant';

import { saveVaultFile, setSecret, type VaultDocument } from '../storage/vault';

const fakeCodec: SecretCodec = {
  encrypt: (plain) => Buffer.from(plain, 'utf8').toString('base64'),
  decrypt: (encrypted) => Buffer.from(encrypted, 'base64').toString('utf8'),
  isPlaintextFallback: false,
};

export const secret = 'sk-ant-api03-long-secret-7f2c';

export const keyRow: CredentialedAccount = {
  id: 'acc-key',
  provider: 'anthropic',
  kind: 'api-key',
  label: 'build',
  credentialRef: 'cred-key',
};

export const aggregatorRow: CredentialedAccount = {
  id: 'acc-many',
  provider: 'openrouter',
  kind: 'aggregator',
  label: 'shared',
  credentialRef: 'cred-many',
};

export const localRow: LocalAccount = {
  id: 'acc-here',
  provider: 'ollama',
  kind: 'local',
  address: 'http://127.0.0.1:11434',
};

export const planRow: SubscriptionAccount = {
  id: 'acc-plan',
  provider: 'anthropic',
  kind: 'subscription',
  label: 'Max',
};

const everyRefHoldsTheSecret: Readonly<Record<string, string>> = {
  'cred-key': secret,
  'cred-many': secret,
};

export function pointingAt(accountId: string, providerModel = 'claude-sonnet-5'): VirtualModel {
  return { id: 'fast', displayName: 'fast', target: { accountId, providerModel } };
}

export function gatewayHolding(models: readonly VirtualModel[]): GatewayConfig {
  return {
    schemaVersion: GATEWAY_CONFIG_VERSION,
    slug: 'personal',
    displayName: 'Personal',
    port: 8397,
    virtualModels: [...models],
    layout: { nodes: {} },
  };
}

function vaultHolding(entries: Readonly<Record<string, string>>): VaultDocument {
  return Object.entries(entries).reduce<VaultDocument>(
    (vault, [ref, plain]) => setSecret(vault, fakeCodec, ref, plain),
    { schemaVersion: 1, entries: {} },
  );
}

export async function rewriteRegistry(
  userDataPath: string,
  accounts: readonly Account[],
): Promise<void> {
  await writeFile(
    join(userDataPath, 'accounts.json'),
    JSON.stringify({ schemaVersion: ACCOUNTS_VERSION, accounts }),
    'utf8',
  );
}

export async function rewriteVault(
  userDataPath: string,
  credentials: Readonly<Record<string, string>>,
): Promise<void> {
  await saveVaultFile(join(userDataPath, 'vault.bin'), vaultHolding(credentials));
}

export async function storageHolding(
  models: readonly VirtualModel[],
  accounts: readonly Account[],
  credentials: Readonly<Record<string, string>> = everyRefHoldsTheSecret,
): Promise<string> {
  const userDataPath = await mkdtemp(join(tmpdir(), 'recompose-spend-'));
  const config = gatewayHolding(models);

  await mkdir(join(userDataPath, 'gateways'), { recursive: true });
  await writeFile(
    join(userDataPath, 'gateways', `${config.slug}.json`),
    JSON.stringify(config),
    'utf8',
  );
  await rewriteRegistry(userDataPath, accounts);
  await rewriteVault(userDataPath, credentials);

  return userDataPath;
}

export function contextFor(userDataPath: string): SpendGrantContext {
  return {
    userDataPath,
    homeFolder: '/Users/ada',
    getCodec: () => fakeCodec,
    onCorrupt: () => undefined,
  };
}
