import type { EngineStates, GatewayEngineState, IpcRequest } from '@recompose/contracts';
import type { QueryClient } from '@tanstack/react-query';

import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrapIpcResult, withRefusal } from './ipc-result';

const STOPPED: GatewayEngineState = { status: 'stopped' };

export const engineStatesQueryOptions = queryOptions({
  queryKey: ['engine-states'],
  queryFn: async () => unwrapIpcResult(await window.recompose['engine:states']()),
});

/**
 * What the snapshot says about one gateway.
 *
 * @summary The snapshot carries an entry only for a gateway the engine has touched, so a
 * gateway missing from it has never served and reads as stopped.
 */
export function gatewayStateIn(states: EngineStates, slug: string): GatewayEngineState {
  return states[slug] ?? STOPPED;
}

/**
 * Points the lifecycle push at the query cache and hands back the way to stop listening.
 *
 * @summary Every push carries the whole snapshot, so writing it straight into the cache leaves
 * nothing to reconcile and no ordering rule to get wrong.
 */
export function bindEngineStatesToCache(queryClient: QueryClient): () => void {
  return window.recomposeEvents['engine:state']((states) => {
    queryClient.setQueryData(engineStatesQueryOptions.queryKey, states);
  });
}

function useLifecycleMutation(
  reach: (request: IpcRequest<'engine:start'>) => Promise<GatewayEngineState>,
) {
  const queryClient = useQueryClient();

  return withRefusal(
    useMutation({
      mutationFn: reach,
      onSuccess: (state, request) => {
        queryClient.setQueryData(engineStatesQueryOptions.queryKey, (states?: EngineStates) => ({
          ...states,
          [request.slug]: state,
        }));
      },
    }),
  );
}

/** Starts one gateway, and carries the sentence explaining a refusal in `refusal`. */
export function useStartGateway() {
  return useLifecycleMutation(async (request) =>
    unwrapIpcResult(await window.recompose['engine:start'](request)),
  );
}

/** Stops one gateway, and carries the sentence explaining a refusal in `refusal`. */
export function useStopGateway() {
  return useLifecycleMutation(async (request) =>
    unwrapIpcResult(await window.recompose['engine:stop'](request)),
  );
}
