import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const NODE_FLOOR = '^22.18.0 || >=23.6.0';

const RESOLVER = fileURLToPath(new URL('./resolve-transcript.mts', import.meta.url));

const BLOCKING_EXIT_STATUS = 2;

const LOAD_FAILURE_EXIT_STATUS = 1;

/**
 * @param {string} reason
 * @returns {never}
 */
function blockToolCall(reason) {
  console.error(`the test-first gate never ran, so the tool call is denied: ${reason}`);
  process.exit(BLOCKING_EXIT_STATUS);
}

function main() {
  const run = spawnSync(process.execPath, [RESOLVER], { stdio: 'inherit' });

  if (run.error !== undefined) {
    blockToolCall(`${RESOLVER} did not start: ${run.error.message}`);
  }

  if (run.status === null) {
    blockToolCall(`${RESOLVER} was killed by ${String(run.signal)}`);
  }

  if (run.status === LOAD_FAILURE_EXIT_STATUS) {
    blockToolCall(
      `node ${process.version} could not run ${RESOLVER}; the gate needs node ${NODE_FLOOR}, which strips TypeScript without a flag`,
    );
  }

  process.exit(run.status);
}

function isEntryPoint() {
  const entry = process.argv[1];

  if (entry === undefined) {
    return false;
  }

  try {
    return pathToFileURL(realpathSync(entry)).href === import.meta.url;
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  main();
}
