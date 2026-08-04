import type { AccountsDocument, LocalRuntimeId, RuntimeReachability } from '@recompose/contracts';

import { localRuntimes } from '@recompose/contracts';
import { randomUUID } from 'node:crypto';

import type { IpcHandlers } from './dispatch';

import { amendAccountsFile, loadAccountsFile } from '../storage/accounts-store';
import { storagePathsFor } from './storage-context';
import { ipcFailure, storageFailure } from './storage-envelope';

export type LocalRuntimesIpcContext = {
  userDataPath: string;
  homeFolder: string;
  onCorrupt: (quarantinedPath: string) => void;
  probeRuntime: (address: string) => Promise<RuntimeReachability>;
};

type LocalRuntimesIpcHandlers = Pick<
  IpcHandlers,
  'accounts:connect-local' | 'accounts:detect-runtime' | 'accounts:check-runtime'
>;

function runtimesStandingIn(accounts: AccountsDocument): Set<LocalRuntimeId> {
  return new Set(
    accounts.accounts.flatMap((held) => (held.kind === 'local' ? [held.provider] : [])),
  );
}

function withTheRuntimeAppended(
  accounts: AccountsDocument,
  runtime: LocalRuntimeId,
  id: string,
): AccountsDocument {
  return {
    ...accounts,
    accounts: [
      ...accounts.accounts,
      { id, provider: runtime, kind: 'local', address: localRuntimes[runtime].address },
    ],
  };
}

async function connectRuntime(ctx: LocalRuntimesIpcContext, runtime: LocalRuntimeId) {
  const paths = storagePathsFor(ctx.userDataPath);
  const minted = `acc-${randomUUID()}`;

  try {
    const amended = await amendAccountsFile(paths.accountsFile, ctx.onCorrupt, (fresh) =>
      runtimesStandingIn(fresh).has(runtime)
        ? fresh
        : withTheRuntimeAppended(fresh, runtime, minted),
    );

    return amended.accounts.some((held) => held.id === minted)
      ? { ok: true as const, value: amended }
      : ipcFailure('name-conflict', `${localRuntimes[runtime].name} is already connected.`);
  } catch (error) {
    return storageFailure(error, ctx.homeFolder);
  }
}

async function checkStoredRuntime(ctx: LocalRuntimesIpcContext, id: string) {
  const paths = storagePathsFor(ctx.userDataPath);

  try {
    const stored = await loadAccountsFile(paths.accountsFile, ctx.onCorrupt);
    const row = stored.accounts.find((held) => held.id === id);

    if (row?.kind !== 'local') {
      return ipcFailure('storage-failed', `no local runtime is held under ${id}.`);
    }

    return { ok: true as const, value: await ctx.probeRuntime(row.address) };
  } catch (error) {
    return storageFailure(error, ctx.homeFolder);
  }
}

/**
 * The three channels a local runtime travels, none of which can carry a secret.
 *
 * @summary Detection answers from the address the runtime documents, before anything is stored.
 * Connecting mints that same address here rather than taking one from the renderer, so no stored
 * row can ever name localhost. The already-standing check and the append share one amend turn, so
 * two racing adds cannot both mint. Nothing on this path opens or references the vault, because a
 * local runtime holds no credential to keep.
 */
export function createLocalRuntimesIpcHandlers(
  ctx: LocalRuntimesIpcContext,
): LocalRuntimesIpcHandlers {
  return {
    'accounts:detect-runtime': async ({ runtime }) => ({
      ok: true as const,
      value: await ctx.probeRuntime(localRuntimes[runtime].address),
    }),
    'accounts:check-runtime': async ({ id }) => checkStoredRuntime(ctx, id),
    'accounts:connect-local': async ({ runtime }) => connectRuntime(ctx, runtime),
  };
}
