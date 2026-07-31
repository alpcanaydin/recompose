import {
  GATEWAY_CONFIG_VERSION,
  loadGatewayConfig,
  type GatewayConfig,
} from '@recompose/contracts';
import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import {
  newerSchemaVersion,
  quarantineFile,
  readJsonWithQuarantine,
  writeJsonAtomic,
} from './json-file';

/**
 * A gateway document this build is too old to read.
 *
 * @summary Thrown instead of quarantining, so a person who ran a newer build and came back keeps
 * the gateway rather than watching it disappear from the sidebar, the tray, and the list.
 */
export class GatewayNewerSchemaError extends Error {
  readonly schemaVersion: number;

  constructor(schemaVersion: number) {
    super(
      `the gateway document names schema version ${String(schemaVersion)}, and this build reads up to ${String(GATEWAY_CONFIG_VERSION)}`,
    );
    this.name = 'GatewayNewerSchemaError';
    this.schemaVersion = schemaVersion;
  }
}

export async function saveGatewayConfig(dir: string, config: GatewayConfig): Promise<void> {
  await writeJsonAtomic(join(dir, `${config.slug}.json`), config);
}

async function loadOneGatewayConfig(
  filePath: string,
  onCorrupt: (quarantinedPath: string) => void,
): Promise<GatewayConfig | undefined> {
  const raw = await readJsonWithQuarantine(filePath, onCorrupt);

  if (raw === undefined) {
    return undefined;
  }

  const newer = newerSchemaVersion(raw, GATEWAY_CONFIG_VERSION);

  if (newer !== undefined) {
    throw new GatewayNewerSchemaError(newer);
  }

  try {
    return loadGatewayConfig(raw);
  } catch {
    await quarantineFile(filePath, onCorrupt);

    return undefined;
  }
}

export async function listGatewayConfigs(
  dir: string,
  onCorrupt: (quarantinedPath: string) => void,
): Promise<GatewayConfig[]> {
  await mkdir(dir, { recursive: true });
  const entries = await readdir(dir);
  const jsonEntries = entries.filter((name) => name.endsWith('.json')).sort();
  const loaded = await Promise.all(
    jsonEntries.map(async (entry) => loadOneGatewayConfig(join(dir, entry), onCorrupt)),
  );

  return loaded.filter((config): config is GatewayConfig => config !== undefined);
}
