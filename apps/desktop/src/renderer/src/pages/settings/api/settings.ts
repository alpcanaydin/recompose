import type { SettingsPatch } from '@recompose/contracts';

import { withSettingsPatch } from '@recompose/contracts';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrapIpcResult } from '../../../shared/api';
import { systemQueryOptions } from './system';

export const settingsQueryOptions = queryOptions({
  queryKey: ['settings'],
  queryFn: async () => unwrapIpcResult(await window.recompose['settings:get']()),
});

type SettingsWriter = {
  save: (patch: SettingsPatch) => void;
  unsavedFields: readonly string[];
};

export function useSettingsWriter(): SettingsWriter {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    scope: { id: 'settings' },
    mutationFn: async (patch: SettingsPatch) =>
      unwrapIpcResult(await window.recompose['settings:save'](patch)),
    onMutate: async (patch: SettingsPatch) => {
      await queryClient.cancelQueries({ queryKey: settingsQueryOptions.queryKey });

      const stored = queryClient.getQueryData(settingsQueryOptions.queryKey);

      queryClient.setQueryData(settingsQueryOptions.queryKey, (current) =>
        current === undefined ? current : withSettingsPatch(current, patch),
      );

      return stored;
    },
    onError: (_error, _patch, stored) => {
      queryClient.setQueryData(settingsQueryOptions.queryKey, stored);
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: settingsQueryOptions.queryKey }),
        queryClient.invalidateQueries({ queryKey: systemQueryOptions.queryKey }),
      ]);
    },
  });

  return {
    save: mutation.mutate,
    unsavedFields: mutation.isError ? Object.keys(mutation.variables) : [],
  };
}
