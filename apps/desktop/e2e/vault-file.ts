import type { ElectronApplication } from '@playwright/test';

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { userDataFolder } from './provider-screen';

async function vaultFile(app: ElectronApplication): Promise<string> {
  return join(await userDataFolder(app), 'vault.bin');
}

function keptIn(vault: unknown): unknown {
  return typeof vault === 'object' && vault !== null && 'entries' in vault
    ? vault.entries
    : undefined;
}

function secretsIn(vault: unknown): number {
  const kept = keptIn(vault);

  return typeof kept === 'object' && kept !== null ? Object.keys(kept).length : 0;
}

/**
 * The vault exactly as it stands, so a later step can prove a refusal left it alone.
 *
 * @summary The vault only ever exists once something is kept in it, so its absence reads as
 * nothing kept rather than as a scenario that never ran.
 */
export async function vaultBytes(app: ElectronApplication): Promise<string> {
  const file = await vaultFile(app);

  return existsSync(file) ? readFile(file, 'utf8') : '';
}

/** How many secrets the vault holds, which is none while the app has kept nothing in it. */
export async function secretsHeldInVault(app: ElectronApplication): Promise<number> {
  const kept = await vaultBytes(app);

  if (kept === '') {
    return 0;
  }

  const held: unknown = JSON.parse(kept);

  return secretsIn(held);
}
