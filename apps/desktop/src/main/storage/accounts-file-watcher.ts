import { loadAccountsDocument } from '@recompose/contracts';
import { watch } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, normalize, resolve } from 'node:path';

import { accountsDocumentSemanticHash } from './model-policy-diff';

type WatchHandle = { close: () => void };

export type AccountsWatchEvents = {
  change: (filename: string | null) => void;
  error: (failure: unknown) => void;
};

type AccountsWatchDirectory = (directory: string, events: AccountsWatchEvents) => WatchHandle;

type AccountsWatcherOptions = {
  filePath: string;
  onChanged: () => void;
  onError?: ((failure: unknown) => void) | undefined;
  debounceMs?: number | undefined;
  watchDirectory?: AccountsWatchDirectory | undefined;
  read?: ((filePath: string) => Promise<string | undefined>) | undefined;
};

function nodeWatchDirectory(directory: string, events: AccountsWatchEvents): WatchHandle {
  const handle = watch(directory, { persistent: false, encoding: 'utf8' }, (_event, filename) => {
    events.change(filename);
  });

  handle.on('error', events.error);

  return handle;
}

async function readAccountsText(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, 'utf8');
  } catch (failure) {
    if (isMissingFile(failure)) return undefined;

    throw failure;
  }
}

function isMissingFile(failure: unknown): boolean {
  return (
    typeof failure === 'object' &&
    failure !== null &&
    'code' in failure &&
    failure.code === 'ENOENT'
  );
}

export function normalizedAccountsEventPath(
  filePath: string,
  filename: string | null,
): string | undefined {
  if (filename === null) return normalize(resolve(filePath));

  const trimmed = filename.trim();

  if (trimmed === '') return undefined;

  const candidate = isAbsolute(trimmed) ? resolve(trimmed) : resolve(dirname(filePath), trimmed);
  const target = resolve(filePath);

  return normalize(candidate) === normalize(target) ? normalize(target) : undefined;
}

function semanticHash(text: string | undefined): string | undefined {
  if (text === undefined || text.trim() === '') return undefined;

  const parsed: unknown = JSON.parse(text);
  const accounts = loadAccountsDocument(parsed);

  return accountsDocumentSemanticHash(accounts);
}

export class AccountsFileWatcher {
  private readonly options: AccountsWatcherOptions;
  private hash: string | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private handle: WatchHandle | undefined;

  constructor(options: AccountsWatcherOptions) {
    this.options = options;
  }

  async prime(): Promise<void> {
    const next = await this.readHash();

    if (next !== undefined) this.hash = next;
  }

  async start(): Promise<void> {
    this.close();
    await this.prime();
    this.openWatch();
  }

  async refresh(): Promise<void> {
    const next = await this.readHash();

    if (next === undefined || next === this.hash) return;

    this.hash = next;
    this.options.onChanged();
  }

  close(): void {
    const handle = this.handle;

    this.handle = undefined;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    handle?.close();
  }

  private openWatch(): void {
    this.handle = (this.options.watchDirectory ?? nodeWatchDirectory)(
      dirname(this.options.filePath),
      {
        change: (filename) => {
          if (normalizedAccountsEventPath(this.options.filePath, filename) !== undefined)
            this.schedule();
        },
        error: (failure) => {
          this.options.onError?.(failure);
        },
      },
    );
  }

  private schedule(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);

    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.refresh().catch((failure: unknown) => {
        this.options.onError?.(failure);
      });
    }, this.options.debounceMs ?? 75);
  }

  private async readHash(): Promise<string | undefined> {
    return semanticHash(await (this.options.read ?? readAccountsText)(this.options.filePath));
  }
}
