import { readFileSync } from 'node:fs';

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

function escapeForRegExp(symbol: string): string {
  return symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function citesSymbol(text: string, symbol: string): boolean {
  return new RegExp(`\\b${escapeForRegExp(symbol)}\\b`).test(text);
}

function missingSymbols(text: string, symbols: readonly string[]): readonly string[] {
  return symbols.filter((symbol) => !citesSymbol(text, symbol));
}

function failuresForEntry(entry: CodeMapEntry, text: string | null): readonly CitationFailure[] {
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
  const failures = entries.flatMap((entry) => failuresForEntry(entry, readFile(entry.path)));

  return failures.length === 0 ? { status: 'pass', failures: [] } : { status: 'fail', failures };
}

function readRepositoryFile(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readSymbols(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function readCodeMapEntry(value: unknown): CodeMapEntry {
  if (
    !isRecord(value) ||
    typeof value['path'] !== 'string' ||
    typeof value['layer'] !== 'string' ||
    typeof value['note'] !== 'string'
  ) {
    throw new Error('a code-map entry is missing a required field');
  }

  return {
    path: value['path'],
    symbols: readSymbols(value['symbols']),
    layer: value['layer'],
    note: value['note'],
  };
}

function readCodeMapEntries(raw: string): readonly CodeMapEntry[] {
  const parsed: unknown = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error('the code map must be a JSON array of entries');
  }

  return parsed.map(readCodeMapEntry);
}

function main(): void {
  const entries = readCodeMapEntries(readFileSync(0, 'utf8'));
  const verdict = validate(entries, readRepositoryFile);

  console.log(JSON.stringify(verdict));

  if (verdict.status === 'fail') {
    process.exitCode = 1;
  }
}

if (isProcessEntryPoint(import.meta.url)) {
  main();
}
