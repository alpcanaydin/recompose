import type { IpcRequest, LocalRuntimeId, RecomposeIpcEvents } from '@recompose/contracts';
import type { QueryClient } from '@tanstack/react-query';

import { documentedRuntimePort } from '@recompose/contracts';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrapIpcResult } from './ipc-result';

export const accountsQueryOptions = queryOptions({
  queryKey: ['accounts'],
  queryFn: async () => unwrapIpcResult(await window.recompose['accounts:list']()),
});

export function bindAccountChangesToCache(
  queryClient: QueryClient,
  subscribe: RecomposeIpcEvents['accounts:changed'] = window.recomposeEvents['accounts:changed'],
): () => void {
  return subscribe(() => {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: accountsQueryOptions.queryKey }),
      queryClient.invalidateQueries({ queryKey: ['provider-models'] }),
    ]);
  });
}

/**
 * Whether a runtime answers at the loopback host on the chosen port, read before anything stores.
 *
 * @summary Reach for it from the detect step the moment it opens, so the look never waits on a
 * button. The port defaults to the documented one and keys the reading, so pointing the look at
 * another port is a fresh question rather than a stale answer. The reading dies with the screen:
 * nothing caches it past unmount, and every mount looks again, because a server that stopped since
 * the last look must never read as running. The look runs whatever the machine says about the
 * internet, because it reaches loopback over IPC: a dropped Wi-Fi connection must never hold back
 * a question about this machine.
 */
export function runtimeDetectionQueryOptions(runtime: LocalRuntimeId, port?: number) {
  const lookedAt = port ?? documentedRuntimePort(runtime);

  return queryOptions({
    queryKey: ['runtime-detection', runtime, lookedAt],
    queryFn: async () =>
      unwrapIpcResult(
        await window.recompose['accounts:detect-runtime']({ runtime, port: lookedAt }),
      ),
    gcTime: 0,
    refetchOnMount: 'always',
  });
}

/**
 * Whether a stored runtime answers at its stored address, read as of this look.
 *
 * @summary Reach for it from a local row on every mount and on every Check again. The standing is
 * an observation rather than a stored fact, so nothing caches it past unmount and no row ever
 * carries a claim older than its own screen. The look rides loopback over IPC, so it runs whatever
 * the machine says about the internet rather than leaving the row without a chip.
 */
export function runtimeStandingQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['runtime-standing', id],
    queryFn: async () => unwrapIpcResult(await window.recompose['accounts:check-runtime']({ id })),
    gcTime: 0,
    refetchOnMount: 'always',
  });
}

/**
 * Stores a local runtime as the credential-free account the person decided on.
 *
 * @summary The request carries only the runtime id, because main mints the stored address from
 * the documented table and nothing on this path can hold a secret. The registry grew a row, so
 * the accounts reading is asked again. The act runs whatever the machine says about the internet,
 * because it writes a local registry row over IPC rather than reaching any provider.
 */
export function useConnectLocalRuntime() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: IpcRequest<'accounts:connect-local'>) =>
      unwrapIpcResult(await window.recompose['accounts:connect-local'](request)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useConnectAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: IpcRequest<'accounts:connect'>) =>
      unwrapIpcResult(await window.recompose['accounts:connect'](request)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

async function verifyStoredKey(request: IpcRequest<'accounts:check-key'>) {
  return unwrapIpcResult(await window.recompose['accounts:check-key'](request));
}

/**
 * The question a person asks of one stored key, answered as of the moment it is asked.
 *
 * @summary Reach for it from a key's row. The answer invalidates nothing, because the act writes
 * nothing: it lives in this mutation while the screen stands, and a remount forgets it rather
 * than keeping a claim the provider can revoke without telling anyone.
 */
export function useVerifyKey() {
  return useMutation({ mutationFn: verifyStoredKey });
}

export function useRemoveAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: IpcRequest<'accounts:remove'>) =>
      unwrapIpcResult(await window.recompose['accounts:remove'](request)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}
