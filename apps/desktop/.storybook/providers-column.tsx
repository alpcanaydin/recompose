import type { Decorator } from '@storybook/react-vite';

export const inProvidersColumn: Decorator = (Story) => (
  <div className="mx-auto w-full max-w-column p-6">
    <Story />
  </div>
);
