import { ProviderLogStore } from './provider-log-store';
import { providerObservability } from './provider-observability';

const installed = new WeakSet<ProviderLogStore>();
let configuredDirectory: string | undefined;
let configuredStore: ProviderLogStore | null = null;

function logDirectoryFromEnvironment(): string | null {
  const directory = process.env['RECOMPOSE_LOG_DIR']?.trim();

  return directory === undefined || directory === '' ? null : directory;
}

export function configuredProviderLogStore(): ProviderLogStore | null {
  const directory = logDirectoryFromEnvironment();

  if (directory === null) return null;
  if (configuredStore !== null && configuredDirectory === directory) return configuredStore;

  configuredDirectory = directory;
  configuredStore = new ProviderLogStore(directory);

  return configuredStore;
}

export function persistProviderObservations(store: ProviderLogStore): void {
  if (installed.has(store)) return;

  installed.add(store);
  providerObservability().subscribe((record) => {
    store.append(record);
  });
}
