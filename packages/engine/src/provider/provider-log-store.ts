import { appendFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { ProviderObservation } from './provider-observability';

import {
  cursorFor,
  cursorMatches,
  decodedLogCursor,
  encodedLogCursor,
  type LogCursor,
} from './provider-log-cursor';
import { providerLogLine } from './provider-log-record';
import { rotateProviderLog } from './provider-log-rotation';

export type LogRead = {
  lines: string[];
  lineCount: number;
  latestTimestamp: number;
  nextCursor: string;
  cursorReset: boolean;
};

type LogFile = { name: string; path: string; size: number; modified: number };
type FileLines = { lines: string[]; endOffset: number; latestTimestamp: number };
type ReadOptions = { cursor?: string; after?: number; limit?: number };
type NormalizedRead = { cursor?: string; after: number; limit: number };
type LogStoreOptions = { maxBytes?: number; maxFiles?: number };

const mainLog = 'main.log';
const maxLineBytes = 8 * 1024 * 1024;
const timestampPattern = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/u;

function logFileName(name: string): boolean {
  return (
    name === mainLog ||
    /^main\.log\.\d+$/u.test(name) ||
    /^main-\d{4}-\d{2}-\d{2}T[\d-]+\.log$/u.test(name)
  );
}

function lineTimestamp(line: string): number {
  const match = timestampPattern.exec(line)?.[1];

  return match === undefined ? 0 : Math.floor(new Date(match.replace(' ', 'T')).getTime() / 1000);
}

function completeBoundary(data: Buffer): number {
  const lf = data.lastIndexOf(10);

  return lf < 0 ? 0 : lf + 1;
}

function completeLines(data: Buffer, offset = 0): FileLines {
  const boundary = completeBoundary(data);
  const segment = data.subarray(Math.min(offset, boundary), boundary);
  const lines = segment
    .toString('utf8')
    .split('\n')
    .slice(0, -1)
    .map((line) => (line.endsWith('\r') ? line.slice(0, -1) : line));

  if (lines.some((line) => Buffer.byteLength(line) > maxLineBytes)) {
    throw new Error('log line exceeds 8388608 bytes');
  }

  return {
    lines,
    endOffset: boundary,
    latestTimestamp: lines.reduce((latest, line) => Math.max(latest, lineTimestamp(line)), 0),
  };
}

async function logFiles(directory: string): Promise<LogFile[]> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const candidates = entries.filter((entry) => entry.isFile() && logFileName(entry.name));
  const files = await Promise.all(
    candidates.map(async (entry): Promise<LogFile> => {
      const path = join(directory, entry.name);
      const metadata = await stat(path);

      return { name: entry.name, path, size: metadata.size, modified: metadata.mtimeMs };
    }),
  );

  return files.sort(
    (left, right) => left.modified - right.modified || left.name.localeCompare(right.name),
  );
}

async function cursorStart(files: readonly LogFile[], cursor: LogCursor): Promise<number> {
  const matches = await Promise.all(
    files.map(async (file) => file.size >= cursor.offset && cursorMatches(file, cursor)),
  );

  return matches.findIndex(Boolean);
}

async function readFrom(
  files: readonly LogFile[],
  start: number,
  offset: number,
  latest: number,
  limit: number,
): Promise<{ lines: string[]; latest: number; file: LogFile; offset: number }> {
  const lines: string[] = [];
  let endOffset = offset;
  let newest = latest;
  let current = requiredFile(files[start]);

  const selected = files.slice(start);
  const pairs = await Promise.all(
    selected.map(async (file) => ({ file, content: await readFile(file.path) })),
  );

  for (const [index, { file, content }] of pairs.entries()) {
    const baseOffset = index === 0 ? offset : 0;
    const read = completeLines(content, baseOffset);
    const selectedLines = linesForLimit(read.lines, lines.length, limit);

    lines.push(...selectedLines);
    newest = Math.max(newest, read.latestTimestamp);
    endOffset = offsetForLines(baseOffset, read, selectedLines);
    current = file;

    if (reachedLimit(limit, lines.length)) break;
  }

  return { lines, latest: newest, file: current, offset: endOffset };
}

function reachedLimit(limit: number, count: number): boolean {
  return limit > 0 && count >= limit;
}

function linesForLimit(lines: readonly string[], already: number, limit: number): string[] {
  return limit > 0 ? lines.slice(0, Math.max(0, limit - already)) : [...lines];
}

function offsetForLines(baseOffset: number, read: FileLines, lines: readonly string[]): number {
  if (lines.length === read.lines.length) return read.endOffset;

  return baseOffset + Buffer.byteLength(`${lines.join('\n')}\n`);
}

function requiredFile(file: LogFile | undefined): LogFile {
  if (file === undefined) throw new Error('log cursor file is unavailable');

  return file;
}

function normalizedRead(options: ReadOptions): NormalizedRead {
  return {
    ...(options.cursor === undefined ? {} : { cursor: options.cursor }),
    after: options.after ?? 0,
    limit: options.limit ?? 0,
  };
}

function limited(lines: readonly string[], limit: number): string[] {
  return limit > 0 ? lines.slice(-limit) : [...lines];
}

export class ProviderLogStore {
  private readonly directory: string;
  private readonly options: Required<LogStoreOptions>;
  private writes: Promise<void> = Promise.resolve();

  public constructor(directory: string, options: LogStoreOptions = {}) {
    this.directory = directory;
    this.options = {
      maxBytes: options.maxBytes ?? 10 * 1024 * 1024,
      maxFiles: options.maxFiles ?? 5,
    };
  }

  public append(record: ProviderObservation): void {
    const line = providerLogLine(record);

    this.writes = this.writes
      .then(async () => {
        await mkdir(this.directory, { recursive: true });
        await rotateProviderLog(
          this.directory,
          Buffer.byteLength(line),
          this.options.maxBytes,
          this.options.maxFiles,
        );
        await appendFile(join(this.directory, mainLog), line, 'utf8');
      })
      .catch((failure: unknown) => {
        console.error('recompose could not persist a provider log record.', failure);
      });
  }

  public async flush(): Promise<void> {
    await this.writes;
  }

  public async read(options: ReadOptions = {}): Promise<LogRead> {
    await this.flush();
    const files = await logFiles(this.directory);
    const request = normalizedRead(options);

    if (files.length === 0) return emptyRead(request.cursor !== undefined, request.after);

    return request.cursor === undefined
      ? this.readTail(files, request.after, request.limit)
      : this.readRequestedCursor(files, request.cursor, request.limit);
  }

  public async clear(): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    await writeFile(join(this.directory, mainLog), '', 'utf8');
  }

  private async readTail(
    files: readonly LogFile[],
    after: number,
    limit: number,
  ): Promise<LogRead> {
    const read = await readFrom(files, 0, 0, after, 0);
    const selected = limited(
      after === 0 ? read.lines : read.lines.filter((line) => lineTimestamp(line) > after),
      limit,
    );

    return {
      lines: selected,
      lineCount: limit > 0 && after === 0 ? selected.length : read.lines.length,
      latestTimestamp: read.latest,
      nextCursor: await cursorFor(read.file, read.offset, read.latest),
      cursorReset: false,
    };
  }

  private async readRequestedCursor(
    files: readonly LogFile[],
    rawCursor: string,
    limit: number,
  ): Promise<LogRead> {
    const cursor = decodedLogCursor(rawCursor);

    if (cursor === null) throw new Error('invalid log cursor');

    return this.readCursor(files, cursor, limit);
  }

  private async readCursor(
    files: readonly LogFile[],
    cursor: LogCursor,
    limit: number,
  ): Promise<LogRead> {
    const start = await cursorStart(files, cursor);

    if (start < 0) return { ...(await this.readTail(files, 0, limit)), cursorReset: true };

    const read = await readFrom(files, start, cursor.offset, cursor.latestTimestamp, limit);

    return cursorReadResult(read, cursor);
  }
}

async function cursorReadResult(
  read: { lines: string[]; latest: number; file: LogFile; offset: number },
  cursor: LogCursor,
): Promise<LogRead> {
  const lines = read.lines;

  if (lines.length === 0) {
    return {
      lines: [],
      lineCount: 0,
      latestTimestamp: cursor.latestTimestamp,
      nextCursor: encodedLogCursor(cursor),
      cursorReset: false,
    };
  }

  return {
    lines,
    lineCount: lines.length,
    latestTimestamp: read.latest,
    nextCursor: await cursorFor(read.file, read.offset, read.latest),
    cursorReset: false,
  };
}

function emptyRead(cursorReset: boolean, latestTimestamp: number): LogRead {
  return { lines: [], lineCount: 0, latestTimestamp, nextCursor: '', cursorReset };
}
