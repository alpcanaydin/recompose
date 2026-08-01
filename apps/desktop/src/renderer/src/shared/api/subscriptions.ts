import type { IpcRequest } from '@recompose/contracts';

import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrapIpcResult, withRefusal } from './ipc-result';

const subscriptionsQueryOptions = queryOptions({
  queryKey: ['subscriptions'],
  queryFn: async () => unwrapIpcResult(await window.recompose['subscriptions:list']()),
});

/**
 * What the machine reports about each provider's own command-line tool.
 *
 * @summary Only the main process can look at the machine, so presence, the sign-in command, and
 * the shell line all arrive as one observation rather than being guessed at on screen.
 */
export const subscriptionToolsQueryOptions = queryOptions({
  queryKey: ['subscription-tools'],
  queryFn: async () => unwrapIpcResult(await window.recompose['subscriptions:tools']()),
});

/**
 * Hands the sign-in to the provider's own tool and waits for it to report.
 *
 * @summary The channel answers with the whole list after the act, so the answer is published as
 * the new truth rather than as a hint to go and re-ask. A refused sign-in carries its sentence,
 * because a sign-in that stops has nothing else on screen to explain itself with.
 */
export function useSignInSubscription() {
  const queryClient = useQueryClient();

  return withRefusal(
    useMutation({
      mutationFn: async (request: IpcRequest<'subscriptions:sign-in'>) =>
        unwrapIpcResult(await window.recompose['subscriptions:sign-in'](request)),
      onSuccess: (views) => {
        queryClient.setQueryData(subscriptionsQueryOptions.queryKey, views);
      },
    }),
  );
}
