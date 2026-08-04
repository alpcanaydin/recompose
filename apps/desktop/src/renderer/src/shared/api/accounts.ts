import type { IpcRequest, LocalRuntimeId } from '@recompose/contracts';

import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrapIpcResult } from './ipc-result';

export const accountsQueryOptions = queryOptions({
  queryKey: ['accounts'],
  queryFn: async () => unwrapIpcResult(await window.recompose['accounts:list']()),
});

/**
 * Whether a runtime answers at its documented address, read before anything stores.
 *
 * @summary Reach for it from the detect step the moment it opens, so the look never waits on a
 * button. The reading dies with the screen: nothing caches it past unmount, and every mount looks
 * again, because a server that stopped since the last look must never read as running.
 */
export function runtimeDetectionQueryOptions(runtime: LocalRuntimeId) {
  return queryOptions({
    queryKey: ['runtime-detection', runtime],
    queryFn: async () =>
      unwrapIpcResult(await window.recompose['accounts:detect-runtime']({ runtime })),
    gcTime: 0,
    refetchOnMount: 'always',
  });
}

/**
 * Stores a local runtime as the credential-free account the person decided on.
 *
 * @summary The request carries only the runtime id, because main mints the stored address from
 * the documented table and nothing on this path can hold a secret. The registry grew a row, so
 * the accounts reading is asked again.
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
