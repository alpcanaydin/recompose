import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrapIpcResult } from '../../../shared/api';

export const gatewayTokenQueryOptions = queryOptions({
  queryKey: ['gateway-token'],
  queryFn: async () => unwrapIpcResult(await window.recompose['gateway-token:status']()),
});

export function useMintGatewayToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => unwrapIpcResult(await window.recompose['gateway-token:mint']()),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: gatewayTokenQueryOptions.queryKey });
    },
  });
}

export function useCopyGatewayToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      unwrapIpcResult(await window.recompose['gateway-token:copy']());
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: gatewayTokenQueryOptions.queryKey });
    },
  });
}
