import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHECKOUT_ROOT = realpathSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..'));

const LINTER_CONFIGURATION = join(CHECKOUT_ROOT, '.oxlintrc.json');

const FORMATTER_CONFIGURATION = join(CHECKOUT_ROOT, '.oxfmtrc.json');

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

function readToolInput(payload: object): object {
  const toolInput = 'tool_input' in payload ? payload.tool_input : undefined;

  return typeof toolInput === 'object' && toolInput !== null ? toolInput : {};
}

function readEditedPath(payload: object): string | undefined {
  const toolInput = readToolInput(payload);
  const editedPath = 'file_path' in toolInput ? toolInput.file_path : '';

  return typeof editedPath === 'string' && editedPath.length > 0 ? editedPath : undefined;
}

function realPathOf(path: string): string | undefined {
  try {
    return realpathSync(path);
  } catch {
    return undefined;
  }
}

function pathInsideCheckout(editedPath: string): string | undefined {
  const resolved = realPathOf(resolve(CHECKOUT_ROOT, editedPath));

  return resolved?.startsWith(`${CHECKOUT_ROOT}${sep}`) === true ? resolved : undefined;
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

function main(): void {
  const editedPath = readEditedPath(readPayloadObject(readFileSync(0, 'utf8')));

  if (editedPath === undefined || !LINTED_EXTENSIONS.has(extname(editedPath))) {
    return;
  }

  const ownedPath = pathInsideCheckout(editedPath);

  if (ownedPath === undefined) {
    return;
  }

  runFromCheckout(FORMATTER_BINARY_NAME, FORMATTER_CONFIGURATION, ownedPath);
  reportLintOutcome(
    runFromCheckout(LINTER_BINARY_NAME, LINTER_CONFIGURATION, ownedPath),
    ownedPath,
  );
}

main();
