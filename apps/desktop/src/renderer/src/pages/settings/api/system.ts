import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrapIpcResult } from '../../../shared/api';

export const systemQueryOptions = queryOptions({
  queryKey: ['system'],
  queryFn: async () => unwrapIpcResult(await window.recompose['system:get']()),
});

export function useOpenConfigFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      unwrapIpcResult(await window.recompose['system:open-config-folder']());
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: systemQueryOptions.queryKey });
    },
  });
}
