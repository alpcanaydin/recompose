import type { Decorator } from '@storybook/react-vite';

/**
 * Stands a story in the sidebar the shell gives it, at the width the layout fixes.
 *
 * @summary Reach for it in any story for a sidebar group, so the row rhythm and the trailing
 * column it reads back are the ones the shell would give it.
 */
export const withSidebarSurface: Decorator = (Story) => (
  <aside className="w-60 bg-surface-sidebar p-2.5 text-body text-ink-secondary">
    <Story />
  </aside>
);
