import { QueryClient } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';

import { bindAccountChangesToCache } from './accounts';

it('TestReloadClientsNotifiesUsageSubscribersToRefresh', async () => {
  const queryClient = new QueryClient();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
  let notify = (): void => undefined;
  const release = bindAccountChangesToCache(queryClient, (listener) => {
    notify = () => {
      listener('changed');
    };

    return () => undefined;
  });

  notify();
  await vi.waitFor(() => {
    expect(invalidate).toHaveBeenCalledTimes(2);
  });

  expect(invalidate).toHaveBeenNthCalledWith(1, { queryKey: ['accounts'] });
  expect(invalidate).toHaveBeenNthCalledWith(2, { queryKey: ['provider-models'] });
  release();
});
