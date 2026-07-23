import { loadGatewayConfig, type GatewayConfig } from '@recompose/contracts';
import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { quarantineFile, readJsonWithQuarantine, writeJsonAtomic } from './json-file';

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
    jsonEntries.map((entry) => loadOneGatewayConfig(join(dir, entry), onCorrupt)),
  );

  return loaded.filter((config): config is GatewayConfig => config !== undefined);
}
