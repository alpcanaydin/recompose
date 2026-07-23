import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { createAppRouter } from './router';

async function renderAt(path: string) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));

  return render(<RouterProvider router={router} />);
}

test('the shell shows the sidebar and the empty state at the root', async () => {
  const screen = await renderAt('/');

  await expect.element(screen.getByRole('link', { name: 'Gateways' })).toBeVisible();
  await expect.element(screen.getByRole('link', { name: 'Providers' })).toBeVisible();
  await expect
    .element(screen.getByText('Select a gateway or create one to get started.'))
    .toBeVisible();
});

test('an unknown path shows the not-found state inside the shell', async () => {
  const screen = await renderAt('/no-such-page');

  await expect.element(screen.getByText('Not found')).toBeVisible();
  await expect.element(screen.getByRole('link', { name: 'Providers' })).toBeVisible();
});

test('clicking the providers link navigates to the providers screen', async () => {
  const screen = await renderAt('/');

  await screen.getByRole('link', { name: 'Providers' }).click();

  await expect.element(screen.getByRole('heading', { name: 'Providers' })).toBeVisible();
});

test('a valid gateway slug shows the canvas placeholder for that gateway', async () => {
  const screen = await renderAt('/gateways/my-gateway');

  await expect.element(screen.getByRole('heading', { name: 'my-gateway' })).toBeVisible();
  await expect.element(screen.getByText('Canvas coming soon.')).toBeVisible();
});

test('an invalid gateway slug lands on the not-found state', async () => {
  const screen = await renderAt('/gateways/Not%20A%20Slug');

  await expect.element(screen.getByText('Not found')).toBeVisible();
});
