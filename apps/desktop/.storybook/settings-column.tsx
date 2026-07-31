import type { Decorator } from '@storybook/react-vite';

export const inSettingsColumn: Decorator = (Story) => (
  <div className="mx-auto w-full max-w-column p-4">
    <Story />
  </div>
);
