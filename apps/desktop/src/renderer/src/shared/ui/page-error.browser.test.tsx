import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

import { PageError } from './page-error';

const unreadable = 'the settings document could not be read';

function routerWhoseLoaderCanBeRepaired(readable: { yes: boolean }) {
  const rootRoute = createRootRoute();
  const pageRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    loader: () => {
      if (!readable.yes) {
        throw new Error(unreadable);
      }

      return { greeting: 'the page came back' };
    },
    component: function Page() {
      return <h1>the page came back</h1>;
    },
    errorComponent: PageError,
  });

  return createRouter({
    routeTree: rootRoute.addChildren([pageRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
}

test('trying again after the failure is repaired brings the page back', async () => {
  const readable = { yes: false };
  const screen = await render(<RouterProvider router={routerWhoseLoaderCanBeRepaired(readable)} />);

  await expect.element(screen.getByText(unreadable)).toBeVisible();

  readable.yes = true;

  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

  await expect.element(screen.getByRole('heading', { name: 'the page came back' })).toBeVisible();
});
