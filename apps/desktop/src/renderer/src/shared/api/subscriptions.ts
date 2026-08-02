import type { IpcRequest, RecomposeIpc } from '@recompose/contracts';

import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import { accountsQueryOptions } from './accounts';
import { unwrapIpcResult, withRefusal } from './ipc-result';

/**
 * Every subscription account as the machine last observed it.
 *
 * @summary The list is a reading rather than a store: standing, plan, and which account a tool
 * currently runs as all live outside the renderer, so every act republishes the whole list.
 */
export const subscriptionsQueryOptions = queryOptions({
  queryKey: ['subscriptions'],
  queryFn: async () => unwrapIpcResult(await window.recompose['subscriptions:list']()),
});

/**
 * What the machine reports about each provider's own command-line tool.
 *
 * @summary Only the main process can look at the machine, so presence, the sign-in command, and
 * the shell line all arrive as one observation rather than being guessed at on screen. A tool the
 * maintainer installs while the app runs has to count, because the absent-tool surface says to
 * install it and sign in from here, so every surface that shows the reading takes a fresh one.
 */
export const subscriptionToolsQueryOptions = queryOptions({
  queryKey: ['subscription-tools'],
  queryFn: async () => unwrapIpcResult(await window.recompose['subscriptions:tools']()),
  refetchOnMount: 'always',
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

type SubscriptionAct = RecomposeIpc['subscriptions:restore'];

function useSubscriptionAct(act: SubscriptionAct) {
  const queryClient = useQueryClient();

  return withRefusal(
    useMutation({
      mutationFn: async (request: IpcRequest<'subscriptions:restore'>) =>
        unwrapIpcResult(await act(request)),
      onSuccess: (views) => {
        queryClient.setQueryData(subscriptionsQueryOptions.queryKey, views);
      },
    }),
  );
}

/**
 * Sends a lapsed account back through its tool's sign-in.
 *
 * @summary The remedy for a lapse is the same act that made the account, so the row offers it
 * rather than a settings trip, and the answer republishes every row because restoring one account
 * can move the pointer that says which one a tool runs as.
 */
export function useRestoreSubscription() {
  return useSubscriptionAct(async (request) => window.recompose['subscriptions:restore'](request));
}

/**
 * Points a provider's tool at one of its accounts.
 *
 * @summary The pointer lives outside the renderer, one per provider, so the answer carries every
 * row rather than the one that was chosen.
 */
export function useActivateSubscription() {
  return useSubscriptionAct(async (request) => window.recompose['subscriptions:activate'](request));
}

/**
 * Takes a subscription account out of the registry it was held in.
 *
 * @summary Removal is an act on the account row rather than on the sign-in, so it travels the
 * accounts channel, and both the registry and the views it feeds are asked again afterwards.
 */
export function useForgetSubscription() {
  const queryClient = useQueryClient();

  return withRefusal(
    useMutation({
      mutationFn: async (request: IpcRequest<'accounts:remove'>) =>
        unwrapIpcResult(await window.recompose['accounts:remove'](request)),
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: subscriptionsQueryOptions.queryKey });
        await queryClient.invalidateQueries({ queryKey: accountsQueryOptions.queryKey });
      },
    }),
  );
}
