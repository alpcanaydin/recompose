import type { AccountsDocument, GatewayConfig, Settings } from '@recompose/contracts';

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { loadAccountsFile } from './accounts-store';
import { listGatewayConfigs } from './gateway-store';
import { loadSettingsFile } from './settings-store';

export type StorageState = {
  settings: Settings;
  accounts: AccountsDocument;
  gateways: GatewayConfig[];
};

export async function initializeStorage(
  userDataPath: string,
  onCorrupt: (quarantinedPath: string) => void,
): Promise<StorageState> {
  const gatewaysDir = join(userDataPath, 'gateways');

  await mkdir(gatewaysDir, { recursive: true });

  const [settings, accounts, gateways] = await Promise.all([
    loadSettingsFile(join(userDataPath, 'settings.json'), onCorrupt),
    loadAccountsFile(join(userDataPath, 'accounts.json'), onCorrupt),
    listGatewayConfigs(gatewaysDir, onCorrupt),
  ]);

  return { settings, accounts, gateways };
}
