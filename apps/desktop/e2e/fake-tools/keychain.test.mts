import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

const fake = fileURLToPath(new URL('./keychain.mts', import.meta.url));
const item = ['-s', 'recompose-parked-credentials', '-a', 'acc-one'];
const PIPE_HOLDS = 65_536;
// Linux caps a single argument at 32 pages, so the blob has to stay under 131_072 bytes.
const A_LONG_BLOB = 'x'.repeat(PIPE_HOLDS + PIPE_HOLDS / 2);

let store: string;

async function ask(argv: readonly string[]): Promise<string> {
  const child = spawn(process.execPath, [fake, ...argv], {
    env: { ...process.env, RECOMPOSE_FAKE_KEYCHAIN_DIR: store },
  });
  let said = '';

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    said += chunk;
  });
  await once(child, 'close');

  return said;
}

beforeEach(async () => {
  store = await mkdtemp(join(tmpdir(), 'recompose-fake-keychain-'));
});

afterEach(async () => {
  await rm(store, { recursive: true, force: true });
});

describe('the fake security tool', () => {
  test('given a credential longer than a pipe holds, the read hands back every byte of it', async () => {
    await ask(['add-generic-password', '-U', ...item, '-w', A_LONG_BLOB]);

    const read = await ask(['find-generic-password', ...item, '-w']);

    expect(read).toHaveLength(A_LONG_BLOB.length + 1);
  });
});
