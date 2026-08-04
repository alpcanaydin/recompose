import { ACCOUNTS_VERSION, localRuntimes, type RuntimeReachability } from '@recompose/contracts';
import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { LocalRuntimesIpcContext } from './local-runtimes-ipc';

import { createLocalRuntimesIpcHandlers } from './local-runtimes-ipc';

const running: RuntimeReachability = { verdict: 'answers', version: '0.5.1' };

async function aFreshContext(
  answer: (address: string) => RuntimeReachability = () => running,
): Promise<LocalRuntimesIpcContext & { looked: string[] }> {
  const looked: string[] = [];

  return {
    looked,
    userDataPath: await mkdtemp(join(tmpdir(), 'recompose-runtimes-')),
    homeFolder: '/Users/ada',
    onCorrupt: () => undefined,
    probeRuntime: async (address) => {
      looked.push(address);

      return Promise.resolve(answer(address));
    },
  };
}

const aKeyStoredUnderTheRuntimeName = {
  id: 'key-1',
  provider: 'ollama',
  kind: 'api-key',
  label: 'their key',
  credentialRef: 'c-key-1',
} as const;

async function seededWithTheKeyRow(ctx: LocalRuntimesIpcContext): Promise<void> {
  await writeFile(
    join(ctx.userDataPath, 'accounts.json'),
    JSON.stringify({ schemaVersion: ACCOUNTS_VERSION, accounts: [aKeyStoredUnderTheRuntimeName] }),
  );
}

describe('detecting a runtime before anything is stored', () => {
  test('the look goes to the address the runtime documents, and the reading comes back whole', async () => {
    const ctx = await aFreshContext();

    const detected = await createLocalRuntimesIpcHandlers(ctx)['accounts:detect-runtime']({
      runtime: 'ollama',
    });

    expect(detected).toEqual({ ok: true, value: running });
    expect(ctx.looked).toEqual([localRuntimes.ollama.address]);
  });

  test('a runtime that answers nothing is a reading rather than a refusal', async () => {
    const ctx = await aFreshContext(() => ({ verdict: 'unreachable' }));

    const detected = await createLocalRuntimesIpcHandlers(ctx)['accounts:detect-runtime']({
      runtime: 'ollama',
    });

    expect(detected).toEqual({ ok: true, value: { verdict: 'unreachable' } });
  });

  test('a chosen port points the look at the loopback host on that port', async () => {
    const ctx = await aFreshContext();

    const detected = await createLocalRuntimesIpcHandlers(ctx)['accounts:detect-runtime']({
      runtime: 'ollama',
      port: 9000,
    });

    expect(detected).toEqual({ ok: true, value: running });
    expect(ctx.looked).toEqual(['http://127.0.0.1:9000']);
  });

  test('detecting stores nothing at all, because a look is not a decision', async () => {
    const ctx = await aFreshContext();

    await createLocalRuntimesIpcHandlers(ctx)['accounts:detect-runtime']({ runtime: 'ollama' });

    await expect(readdir(ctx.userDataPath)).resolves.toEqual([]);
  });
});

describe('connecting a runtime the person decided to add', () => {
  test('the stored row carries the minted address and no credential of any kind', async () => {
    const ctx = await aFreshContext();

    const connected = await createLocalRuntimesIpcHandlers(ctx)['accounts:connect-local']({
      runtime: 'ollama',
    });

    if (!connected.ok) {
      throw new Error('the runtime was never stored, so no row stands to be read');
    }

    const row = connected.value.accounts[0];

    expect(connected.value.accounts).toHaveLength(1);
    expect(row).toMatchObject({
      provider: 'ollama',
      kind: 'local',
      address: localRuntimes.ollama.address,
    });
    expect(row).not.toHaveProperty('credentialRef');
    expect(row).not.toHaveProperty('label');
    expect(row?.id).not.toBe('');
  });

  test('a chosen port stores the loopback address minted around it', async () => {
    const ctx = await aFreshContext();

    const connected = await createLocalRuntimesIpcHandlers(ctx)['accounts:connect-local']({
      runtime: 'ollama',
      port: 9000,
    });

    if (!connected.ok) {
      throw new Error('the runtime was never stored, so no row stands to be read');
    }

    expect(connected.value.accounts[0]).toMatchObject({
      provider: 'ollama',
      kind: 'local',
      address: 'http://127.0.0.1:9000',
    });
  });

  test('connecting takes no look, because the person already decided', async () => {
    const ctx = await aFreshContext();

    await createLocalRuntimesIpcHandlers(ctx)['accounts:connect-local']({ runtime: 'ollama' });

    expect(ctx.looked).toEqual([]);
  });

  test('the vault file is never created, because a local row holds no secret', async () => {
    const ctx = await aFreshContext();

    await createLocalRuntimesIpcHandlers(ctx)['accounts:connect-local']({ runtime: 'ollama' });

    await expect(readdir(ctx.userDataPath)).resolves.toEqual(['accounts.json']);
  });
});

describe('connecting a runtime that already stands', () => {
  test('the second add refuses by name and the first row survives untouched', async () => {
    const handlers = createLocalRuntimesIpcHandlers(await aFreshContext());
    const first = await handlers['accounts:connect-local']({ runtime: 'ollama' });

    const second = await handlers['accounts:connect-local']({ runtime: 'ollama' });

    expect(second).toMatchObject({ ok: false, error: { code: 'name-conflict' } });

    if (!first.ok || second.ok) {
      throw new Error('the refusal never landed, so the first row cannot be compared');
    }

    expect(second.error.message).toBe(
      'Ollama is already connected. Remove the row to point it at another port.',
    );

    const listed = await handlers['accounts:check-runtime']({
      id: first.value.accounts[0]?.id ?? '',
    });

    expect(listed).toEqual({ ok: true, value: running });
  });

  test('two adds racing each other mint exactly one row', async () => {
    const handlers = createLocalRuntimesIpcHandlers(await aFreshContext());

    const [, second] = await Promise.all([
      handlers['accounts:connect-local']({ runtime: 'ollama' }),
      handlers['accounts:connect-local']({ runtime: 'ollama' }),
    ]);

    expect(second).toMatchObject({ ok: false, error: { code: 'name-conflict' } });
  });
});

describe('checking a runtime the registry already holds', () => {
  test('the look goes to the address the row stored, never to the table', async () => {
    const ctx = await aFreshContext();
    const handlers = createLocalRuntimesIpcHandlers(ctx);
    const connected = await handlers['accounts:connect-local']({ runtime: 'ollama' });

    if (!connected.ok) {
      throw new Error('the runtime was never stored, so nothing stands to be checked');
    }

    ctx.looked.length = 0;

    const checked = await handlers['accounts:check-runtime']({
      id: connected.value.accounts[0]?.id ?? '',
    });

    expect(checked).toEqual({ ok: true, value: running });
    expect(ctx.looked).toEqual([localRuntimes.ollama.address]);
  });

  test('a row nobody holds is refused rather than looked at', async () => {
    const ctx = await aFreshContext();

    const checked = await createLocalRuntimesIpcHandlers(ctx)['accounts:check-runtime']({
      id: 'ghost',
    });

    expect(checked).toEqual({
      ok: false,
      error: { code: 'storage-failed', message: 'no local runtime is held under ghost.' },
    });
    expect(ctx.looked).toEqual([]);
  });
});

describe('a registry that already holds other kinds', () => {
  test('a credentialed account under the runtime name never stands in for the runtime', async () => {
    const ctx = await aFreshContext();

    await seededWithTheKeyRow(ctx);

    const connected = await createLocalRuntimesIpcHandlers(ctx)['accounts:connect-local']({
      runtime: 'ollama',
    });

    if (!connected.ok) {
      throw new Error('the add was refused, so the runtime never joined its neighbors');
    }

    expect(connected.value.accounts).toHaveLength(2);
    expect(connected.value.accounts.at(-1)).toMatchObject({
      kind: 'local',
      address: localRuntimes.ollama.address,
    });
  });

  test('a check finds its own row among neighbors and probes only that address', async () => {
    const ctx = await aFreshContext();

    await seededWithTheKeyRow(ctx);

    const handlers = createLocalRuntimesIpcHandlers(ctx);
    const connected = await handlers['accounts:connect-local']({ runtime: 'ollama' });

    if (!connected.ok) {
      throw new Error('the runtime was never stored, so nothing stands to be checked');
    }

    ctx.looked.length = 0;

    const checked = await handlers['accounts:check-runtime']({
      id: connected.value.accounts.at(-1)?.id ?? '',
    });

    expect(checked).toEqual({ ok: true, value: running });
    expect(ctx.looked).toEqual([localRuntimes.ollama.address]);
  });

  test('a row that is no local runtime is refused by name rather than probed', async () => {
    const ctx = await aFreshContext();

    await seededWithTheKeyRow(ctx);

    const checked = await createLocalRuntimesIpcHandlers(ctx)['accounts:check-runtime']({
      id: aKeyStoredUnderTheRuntimeName.id,
    });

    expect(checked).toEqual({
      ok: false,
      error: { code: 'storage-failed', message: 'no local runtime is held under key-1.' },
    });
    expect(ctx.looked).toEqual([]);
  });
});
