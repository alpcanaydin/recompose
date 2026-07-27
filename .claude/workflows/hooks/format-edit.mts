import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { configurationRoot } from './configuration-scope.mts';
import { readEditedPath } from './hook-payload.mts';
import { repositoryDirectories } from './repository-scope.mts';

const CHECKOUT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const LINTER_CONFIGURATION_NAME = '.oxlintrc.json';

const FORMATTER_CONFIGURATION_NAME = '.oxfmtrc.json';

const LINTER_BINARY_NAME = 'oxlint';

const FORMATTER_BINARY_NAME = 'oxfmt';

const UNMATCHED_PATTERN_ARGUMENT = '--no-error-on-unmatched-pattern';

const LINTED_EXTENSIONS: ReadonlySet<string> = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
]);

const BLOCKING_EXIT_STATUS = 2;

function describeFailure(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function readPayloadObject(raw: string): object {
  try {
    const parsed: unknown = JSON.parse(raw);

    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (cause) {
    console.error(`the formatter hook could not read its payload: ${describeFailure(cause)}`);

    return {};
  }
}

function runFromCheckout(
  binaryName: string,
  configurationPath: string,
  editedPath: string,
): SpawnSyncReturns<string> {
  return spawnSync(
    join(CHECKOUT_ROOT, 'node_modules', '.bin', binaryName),
    [UNMATCHED_PATTERN_ARGUMENT, '--config', configurationPath, editedPath],
    { cwd: CHECKOUT_ROOT, encoding: 'utf8' },
  );
}

function blockEdit(reason: string): never {
  console.error(reason);
  process.exit(BLOCKING_EXIT_STATUS);
}

function reportLintOutcome(lint: SpawnSyncReturns<string>, editedPath: string): void {
  if (lint.error !== undefined) {
    blockEdit(
      `${LINTER_BINARY_NAME} did not start in ${CHECKOUT_ROOT}, so ${editedPath} went unlinted: ${lint.error.message}`,
    );
  }

  if (lint.status !== 0) {
    blockEdit(`${lint.stdout}${lint.stderr}`);
  }
}

function governingRoot(editedPath: string): string {
  return configurationRoot(editedPath, CHECKOUT_ROOT, {
    configurationName: LINTER_CONFIGURATION_NAME,
    configurationExists: existsSync,
    reachableDirectories: (start) => repositoryDirectories(start, CHECKOUT_ROOT),
  });
}

function main(): void {
  const editedPath = readEditedPath(readPayloadObject(readFileSync(0, 'utf8')));

  if (editedPath === undefined || !LINTED_EXTENSIONS.has(extname(editedPath))) {
    return;
  }

  const root = governingRoot(editedPath);

  runFromCheckout(FORMATTER_BINARY_NAME, join(root, FORMATTER_CONFIGURATION_NAME), editedPath);
  reportLintOutcome(
    runFromCheckout(LINTER_BINARY_NAME, join(root, LINTER_CONFIGURATION_NAME), editedPath),
    editedPath,
  );
}

main();
