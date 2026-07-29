import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { PageError } from './page-error';

const unreadable = 'the settings document could not be read';

function FailingPage() {
  const rootRoute = createRootRoute();
  const pageRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    loader: () => {
      throw new Error(unreadable);
    },
    component: () => null,
    errorComponent: PageError,
  });

  return (
    <RouterProvider
      router={createRouter({
        routeTree: rootRoute.addChildren([pageRoute]),
        history: createMemoryHistory({ initialEntries: ['/'] }),
      })}
    />
  );
}

const meta = preview.meta({ component: FailingPage, title: 'shared/ui/PageError' });

/** The failure names what went wrong and offers the way back. */
export const Basic = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(unreadable)).toBeVisible();
    await expect(await canvas.findByRole('button', { name: 'Try again' })).toBeVisible();
  },
});

/** The same failure under the dark scheme. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });
