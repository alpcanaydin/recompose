import type { GatewayConfig } from '@recompose/contracts';

import { watch } from 'node:fs';
import { isAbsolute, normalize, relative, resolve, sep } from 'node:path';

import { gatewayConfigHash } from './gateway-config-hash';
import { listGatewayConfigs } from './gateway-store';

type WatchHandle = { close: () => void };

export type GatewayWatchEvents = {
  change: (filename: string | null) => void;
  close: () => void;
  error: (failure: unknown) => void;
};
export type GatewayWatchDirectory = (
  directory: string,
  signal: AbortSignal | undefined,
  events: GatewayWatchEvents,
) => WatchHandle;

type GatewayWatcherOptions = {
  directory: string;
  onUpsert: (config: GatewayConfig) => void;
  onRemove: (slug: string) => void;
  onCorrupt: (quarantinedPath: string) => void;
  onError?: ((failure: unknown) => void) | undefined;
  debounceMs?: number | undefined;
  watchDirectory?: GatewayWatchDirectory | undefined;
};

function nodeWatchDirectory(
  directory: string,
  signal: AbortSignal | undefined,
  events: GatewayWatchEvents,
): WatchHandle {
  const options =
    signal === undefined
      ? { persistent: false, encoding: 'utf8' as const }
      : { persistent: false, encoding: 'utf8' as const, signal };
  const handle = watch(directory, options, (_event, filename) => {
    events.change(filename);
  });

  handle.on('error', events.error);
  handle.on('close', events.close);

  return handle;
}

function eventKey(directory: string, filename: string | null): string | undefined {
  if (filename === null) return '*';

  const trimmed = filename.trim();

  if (trimmed.length === 0) return undefined;

  const normalized = normalize(relative(resolve(directory), resolve(directory, trimmed)));

  if (!validEventPath(normalized)) return undefined;

  return normalized;
}

function validEventPath(path: string): boolean {
  return !outsideDirectory(path) && !isAbsolute(path) && path.endsWith('.json');
}

function outsideDirectory(path: string): boolean {
  return path === '..' || path.startsWith(`..${sep}`);
}

function aborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted ?? false;
}

export class GatewayConfigWatcher {
  private readonly options: GatewayWatcherOptions;
  private readonly hashes = new Map<string, string>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private handle: WatchHandle | undefined;
  private signal: AbortSignal | undefined;
  private readonly abort = (): void => {
    this.close();
  };

  public constructor(options: GatewayWatcherOptions) {
    this.options = options;
  }

  public async prime(): Promise<void> {
    const configs = await this.configs();

    this.hashes.clear();
    for (const config of configs) this.hashes.set(config.slug, gatewayConfigHash(config));
  }

  public async start(signal?: AbortSignal): Promise<void> {
    this.close();
    if (aborted(signal)) return;

    await this.prime();
    if (aborted(signal)) return;

    this.activate(signal);
  }

  private activate(signal: AbortSignal | undefined): void {
    this.signal = signal;
    signal?.addEventListener('abort', this.abort, { once: true });

    try {
      this.openWatch();
    } catch (failure: unknown) {
      this.close();

      throw failure;
    }
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

  public async refreshImmediately(): Promise<void> {
    this.clearTimers();
    await this.refresh();
  }

  public close(): void {
    const handle = this.handle;

    this.handle = undefined;
    this.signal?.removeEventListener('abort', this.abort);
    this.signal = undefined;
    this.clearTimers();
    handle?.close();
  }

  private clearTimers(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  private schedule(filename: string | null): void {
    const key = eventKey(this.options.directory, filename);

    if (key === undefined) return;

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

  private openWatch(): void {
    let installed: WatchHandle | undefined;
    const events: GatewayWatchEvents = {
      change: (filename) => {
        if (this.handle === installed) this.schedule(filename);
      },
      error: (failure) => {
        if (this.handle === installed) this.options.onError?.(failure);
      },
      close: () => {
        if (this.handle === installed) this.watcherClosed();
      },
    };

    installed = (this.options.watchDirectory ?? nodeWatchDirectory)(
      this.options.directory,
      this.signal,
      events,
    );
    this.handle = installed;
  }

  private watcherClosed(): void {
    this.handle = undefined;
    this.signal?.removeEventListener('abort', this.abort);
    this.signal = undefined;
    this.clearTimers();
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
