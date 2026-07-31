import type { AnyRouter } from '@tanstack/react-router';

import { TanStackDevtools } from '@tanstack/react-devtools';
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';

type AppDevtoolsProps = {
  /** The router whose matches, loaders, and search the router panel reads. */
  router: AnyRouter;
};

/**
 * The router and the query cache, both inspectable through one floating trigger.
 *
 * @summary Reach for it from the root layout, inside the guard that keeps devtools out of any
 * build a person runs. Each library ships a trigger of its own, and the shell has no free
 * corner for a second one, so the panels mount as plugins of a single host instead.
 */
export function AppDevtools({ router }: AppDevtoolsProps) {
  return (
    <TanStackDevtools
      config={{ position: 'middle-right' }}
      plugins={[
        {
          id: 'router',
          name: 'Router',
          render: () => <TanStackRouterDevtoolsPanel router={router} />,
        },
        {
          id: 'react-query',
          name: 'React Query',
          render: () => <ReactQueryDevtoolsPanel />,
        },
      ]}
    />
  );
}
