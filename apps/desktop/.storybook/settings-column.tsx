import type { Decorator } from '@storybook/react-vite';

export const inSettingsColumn: Decorator = (Story) => (
  <div className="mx-auto w-full max-w-[560px] p-4">
    <Story />
  </div>
);
