import type { GatewayConfig } from '@recompose/contracts';

import { watch } from 'node:fs';

import { gatewayConfigHash } from './gateway-config-hash';
import { listGatewayConfigs } from './gateway-store';

type WatchHandle = { close: () => void };
type WatchListener = (filename: string | null) => void;
type WatchDirectory = (directory: string, listener: WatchListener) => WatchHandle;

type GatewayWatcherOptions = {
  directory: string;
  onUpsert: (config: GatewayConfig) => void;
  onRemove: (slug: string) => void;
  onCorrupt: (quarantinedPath: string) => void;
  onError?: ((failure: unknown) => void) | undefined;
  debounceMs?: number | undefined;
  watchDirectory?: WatchDirectory | undefined;
};

function nodeWatchDirectory(directory: string, listener: WatchListener): WatchHandle {
  return watch(directory, { persistent: false, encoding: 'utf8' }, (_event, filename) => {
    listener(filename);
  });
}

function jsonFilename(filename: string | null): boolean {
  return filename === null || filename.endsWith('.json');
}

export class GatewayConfigWatcher {
  private readonly options: GatewayWatcherOptions;
  private readonly hashes = new Map<string, string>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private handle: WatchHandle | undefined;

  public constructor(options: GatewayWatcherOptions) {
    this.options = options;
  }

  public async prime(): Promise<void> {
    const configs = await this.configs();

    this.hashes.clear();
    for (const config of configs) this.hashes.set(config.slug, gatewayConfigHash(config));
  }

  public async start(): Promise<void> {
    await this.prime();
    this.handle = (this.options.watchDirectory ?? nodeWatchDirectory)(
      this.options.directory,
      (filename) => {
        this.schedule(filename);
      },
    );
  }

  public noteWrite(config: GatewayConfig): void {
    this.hashes.set(config.slug, gatewayConfigHash(config));
  }

  public async refresh(): Promise<void> {
    const configs = await this.configs();
    const next = new Map(configs.map((config) => [config.slug, gatewayConfigHash(config)]));

    this.publishUpserts(configs, next);
    this.publishRemovals(next);

    this.hashes.clear();
    for (const [slug, hash] of next) this.hashes.set(slug, hash);
  }

  public close(): void {
    this.handle?.close();
    this.handle = undefined;
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  private schedule(filename: string | null): void {
    if (!jsonFilename(filename)) return;

    const key = filename ?? '*';
    const waiting = this.timers.get(key);

    if (waiting !== undefined) clearTimeout(waiting);

    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key);
        void this.refresh().catch((failure: unknown) => {
          this.options.onError?.(failure);
        });
      }, this.options.debounceMs ?? 75),
    );
  }

  private publishUpserts(
    configs: readonly GatewayConfig[],
    next: ReadonlyMap<string, string>,
  ): void {
    for (const config of configs) {
      if (this.hashes.get(config.slug) !== next.get(config.slug)) this.options.onUpsert(config);
    }
  }

  private publishRemovals(next: ReadonlyMap<string, string>): void {
    for (const slug of this.hashes.keys()) {
      if (!next.has(slug)) this.options.onRemove(slug);
    }
  }

  private async configs(): Promise<GatewayConfig[]> {
    return listGatewayConfigs(this.options.directory, this.options.onCorrupt);
  }
}
