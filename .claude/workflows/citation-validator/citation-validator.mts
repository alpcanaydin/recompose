import { existsSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

import { isProcessEntryPoint } from '../hooks/entry-point.mjs';

export type CodeMapEntry = {
  path: string;
  symbols: readonly string[];
  layer: string;
  note: string;
};

export type CitationFailure = {
  path: string;
  symbol?: string;
  reason: string;
};

export type Verdict = {
  status: 'pass' | 'fail';
  failures: readonly CitationFailure[];
};

const FAILING_VERDICT_STATUS = 1;

const INPUT_ERROR_STATUS = 2;

class PathEscapesRepositoryError extends Error {}

function escapeForRegExp(symbol: string): string {
  return symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isWordCharacter(character: string): boolean {
  return /\w/.test(character);
}

function boundaryFor(edgeCharacter: string): string {
  return isWordCharacter(edgeCharacter) ? '\\b' : '';
}

function symbolPattern(symbol: string): string {
  const escaped = escapeForRegExp(symbol);
  const leading = boundaryFor(symbol.charAt(0));
  const trailing = boundaryFor(symbol.charAt(symbol.length - 1));

  return `${leading}${escaped}${trailing}`;
}

function citesSymbol(text: string, symbol: string): boolean {
  return symbol.length > 0 && new RegExp(symbolPattern(symbol)).test(text);
}

function missingSymbols(text: string, symbols: readonly string[]): readonly string[] {
  return symbols.filter((symbol) => !citesSymbol(text, symbol));
}

function describeFailure(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/** Raised when a cited path names a directory, which holds no text and so holds no symbol. */
export class PathIsDirectoryError extends Error {
  constructor(path: string) {
    super(`path names a directory: ${path}`);
    this.name = 'PathIsDirectoryError';
  }
}

function describeReadFailure(path: string, cause: unknown): string {
  return cause instanceof PathEscapesRepositoryError
    ? `path escapes the repository root: ${path}`
    : `path exists but could not be read: ${path}: ${describeFailure(cause)}`;
}

function failuresForDirectory(entry: CodeMapEntry): readonly CitationFailure[] {
  return entry.symbols.map((symbol) => ({
    path: entry.path,
    symbol,
    reason: `a directory holds no symbol: ${entry.path}: ${symbol}`,
  }));
}

function failuresForEntry(
  entry: CodeMapEntry,
  readFile: (path: string) => string | null,
): readonly CitationFailure[] {
  let text: string | null;

  try {
    text = readFile(entry.path);
  } catch (cause) {
    return cause instanceof PathIsDirectoryError
      ? failuresForDirectory(entry)
      : [{ path: entry.path, reason: describeReadFailure(entry.path, cause) }];
  }

  if (text === null) {
    return [{ path: entry.path, reason: `path not found in the repository: ${entry.path}` }];
  }

  return missingSymbols(text, entry.symbols).map((symbol) => ({
    path: entry.path,
    symbol,
    reason: `symbol not found in ${entry.path}: ${symbol}`,
  }));
}

export function validate(
  entries: readonly CodeMapEntry[],
  readFile: (path: string) => string | null,
): Verdict {
  const failures = entries.flatMap((entry) => failuresForEntry(entry, readFile));

  return failures.length === 0 ? { status: 'pass', failures: [] } : { status: 'fail', failures };
}

function resolveWithinRepository(repositoryRoot: string, path: string): string {
  const resolvedRoot = resolve(repositoryRoot);
  const resolvedPath = resolve(resolvedRoot, path);
  const relativePath = relative(resolvedRoot, resolvedPath);

  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new PathEscapesRepositoryError(path);
  }

  return resolvedPath;
}

function readRepositoryFile(repositoryRoot: string, path: string): string | null {
  const resolvedPath = resolveWithinRepository(repositoryRoot, path);

  if (!existsSync(resolvedPath)) {
    return null;
  }

  if (statSync(resolvedPath).isDirectory()) {
    throw new PathIsDirectoryError(path);
  }

  return readFileSync(resolvedPath, 'utf8');
}

function isDirectory(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory();
}

function requireRepositoryRoot(): string {
  const repositoryRoot = process.argv[2];

  if (repositoryRoot === undefined || repositoryRoot.length === 0) {
    throw new Error('citation-validator requires a repository root argument');
  }

  if (!isDirectory(repositoryRoot)) {
    throw new Error(`citation-validator repository root is not a directory: ${repositoryRoot}`);
  }

  return repositoryRoot;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function requireField(record: Record<string, unknown>, entryIndex: number, field: string): string {
  const value = record[field];

  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`entry ${entryIndex}: "${field}" must be a non-empty string`);
  }

  return value;
}

function requireNonEmptySymbol(value: unknown, entryIndex: number): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`entry ${entryIndex}: "symbols" must be an array of non-empty strings`);
  }

  return value;
}

function requireSymbols(value: unknown, entryIndex: number): readonly string[] {
  if (!Array.isArray(value)) {
    throw new Error(`entry ${entryIndex}: "symbols" must be an array of non-empty strings`);
  }

  return value.map((item) => requireNonEmptySymbol(item, entryIndex));
}

function readCodeMapEntry(value: unknown, entryIndex: number): CodeMapEntry {
  if (!isRecord(value)) {
    throw new Error(`entry ${entryIndex}: must be a JSON object`);
  }

  return {
    path: requireField(value, entryIndex, 'path'),
    symbols: requireSymbols(value['symbols'], entryIndex),
    layer: requireField(value, entryIndex, 'layer'),
    note: requireField(value, entryIndex, 'note'),
  };
}

function readCodeMapEntries(raw: string): readonly CodeMapEntry[] {
  const parsed: unknown = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error('the code map must be a JSON array of entries');
  }

  return parsed.map((value, index) => readCodeMapEntry(value, index));
}

function printInputError(reason: string): void {
  console.log(JSON.stringify({ status: 'error', reason }));
  process.exitCode = INPUT_ERROR_STATUS;
}

function main(): void {
  let repositoryRoot: string;
  let entries: readonly CodeMapEntry[];

  try {
    repositoryRoot = requireRepositoryRoot();
    entries = readCodeMapEntries(readFileSync(0, 'utf8'));
  } catch (cause) {
    printInputError(describeFailure(cause));

    return;
  }

  const verdict = validate(entries, (path) => readRepositoryFile(repositoryRoot, path));

  console.log(JSON.stringify(verdict));

  if (verdict.status === 'fail') {
    process.exitCode = FAILING_VERDICT_STATUS;
  }
}

if (isProcessEntryPoint(import.meta.url)) {
  main();
}
