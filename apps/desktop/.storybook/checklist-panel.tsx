import type { Decorator } from '@storybook/react-vite';

export const inChecklistPanel: Decorator = (Story) => (
  <div className="w-55 rounded-panel border border-line-subtle bg-surface-card p-3">
    <Story />
  </div>
);
