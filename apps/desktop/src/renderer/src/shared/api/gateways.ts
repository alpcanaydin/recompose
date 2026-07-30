import type { GatewayConfig, IpcRequest } from '@recompose/contracts';

import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrapIpcResult } from './ipc-result';

export const gatewaysQueryOptions = queryOptions({
  queryKey: ['gateways'],
  queryFn: async () => unwrapIpcResult(await window.recompose['gateways:list']()),
});

/** A loopback port nothing holds right now, offered by the process that can actually check. */
export async function fetchOfferedPort(): Promise<number> {
  return unwrapIpcResult(await window.recompose['gateways:offer-port']());
}

/** Stores a new gateway, refusing a slug or a port a stored gateway already holds. */
export function useSaveGateway() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (gateway: GatewayConfig) =>
      unwrapIpcResult(await window.recompose['gateways:save'](gateway)),
    onSuccess: (gateways) => {
      queryClient.setQueryData(gatewaysQueryOptions.queryKey, gateways);
    },
  });
}

/** Moves a gateway that lost its port onto a free one, and starts it there. */
export function useMoveGatewayPort() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: IpcRequest<'gateways:move-port'>) =>
      unwrapIpcResult(await window.recompose['gateways:move-port'](request)),
    onSuccess: (gateways) => {
      queryClient.setQueryData(gatewaysQueryOptions.queryKey, gateways);
    },
  });
}
