import type { IpcRequest } from '@recompose/contracts';

import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrapIpcResult } from '../../../shared/api';

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
