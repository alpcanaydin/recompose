import type { ElectronApplication } from '@playwright/test';

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { userDataFolder } from './provider-screen';

function rowsIn(registry: unknown): unknown {
  return typeof registry === 'object' && registry !== null && 'accounts' in registry
    ? registry.accounts
    : undefined;
}

/**
 * How many accounts the registry holds, which is none while the app has stored nothing.
 *
 * @summary The registry only exists once something joins it, so its absence reads as an empty
 * registry rather than as a scenario that never ran.
 */
export async function accountsHeldInRegistry(app: ElectronApplication): Promise<number> {
  const file = join(await userDataFolder(app), 'accounts.json');

  if (!existsSync(file)) {
    return 0;
  }

  const rows = rowsIn(JSON.parse(await readFile(file, 'utf8')));

  return Array.isArray(rows) ? rows.length : 0;
}
