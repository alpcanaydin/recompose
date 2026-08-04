import { QueryClient } from '@tanstack/react-query';

/**
 * The one client every renderer reading and act runs through.
 *
 * @summary Every query and mutation reaches main over preload IPC and none touches the network
 * directly, so the whole client runs in always mode: a machine that reports itself offline must
 * never pause a loopback look, a registry read, or the invalidation that follows an act. The
 * engine's own fetch failing already folds a vendor check to its could-not-run verdict.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, networkMode: 'always' },
      mutations: { retry: false, networkMode: 'always' },
    },
  });
}
