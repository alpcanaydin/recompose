import type { IpcRequest } from '@recompose/contracts';

import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrapIpcResult } from './ipc-result';

export const accountsQueryOptions = queryOptions({
  queryKey: ['accounts'],
  queryFn: async () => unwrapIpcResult(await window.recompose['accounts:list']()),
});

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
