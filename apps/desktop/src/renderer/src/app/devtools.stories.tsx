import preview from '#.storybook/preview';

import { AppDevtools } from './devtools';
import { createQueryClient } from './query-client';
import { createAppRouter } from './router';

/** The devtools host wired to a router of its own, so no router rides in through the args. */
function DevtoolsHarness() {
  return <AppDevtools router={createAppRouter({ queryClient: createQueryClient() })} />;
}

const meta = preview.meta({ component: DevtoolsHarness, parameters: { a11y: { test: 'off' } } });

/**
 * The devtools host, opened by hand to read whether a panel body paints.
 *
 * @summary Reach for it whenever the host or its plugins change. Press the trigger: the router
 * panel must fill with router state, not leave a rail over an empty frame. No assertion rides
 * along, because neither test project can host this widget. The browser project renders the rail
 * but never fills the plugin container, and the storybook project never mounts the host at all,
 * so an assertion in either would report the environment rather than the panel. Axe is off for
 * the same reason: the markup under test belongs to the third-party host, not to this app.
 */
export const HostWithPanels = meta.story({});
