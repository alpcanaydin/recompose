import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { installFakeBridge } from '../shared/testing';
import { AppDevtools } from './devtools';
import { createQueryClient } from './query-client';
import { createAppRouter } from './router';

async function renderDevtools() {
  installFakeBridge();

  return render(<AppDevtools router={createAppRouter({ queryClient: createQueryClient() })} />);
}

test('every devtools panel answers to one trigger rather than one each', async () => {
  const screen = await renderDevtools();

  await expect
    .element(screen.getByRole('button', { name: 'Open TanStack Devtools' }))
    .toBeVisible();
});

test('the one trigger opens on a press and reaches both the router and the cache', async () => {
  const screen = await renderDevtools();

  await screen.getByRole('button', { name: 'Open TanStack Devtools' }).click();

  await expect.element(screen.getByRole('heading', { name: 'Router' })).toBeVisible();
  await expect.element(screen.getByRole('heading', { name: 'React Query' })).toBeVisible();
});
