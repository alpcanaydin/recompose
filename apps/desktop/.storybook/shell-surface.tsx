import type { Decorator } from '@storybook/react-vite';

/**
 * Stands a story on the surface the shell hands a route, at a height it can be measured against.
 *
 * @summary Reach for it in any story whose component fills or floats over the content surface,
 * so the gaps it reads back are the ones the shell would give it.
 */
export const withShellSurface: Decorator = (Story) => (
  <div className="relative h-105 bg-surface-content">
    <Story />
  </div>
);
