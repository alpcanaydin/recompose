import { defineMain } from '@storybook/react-vite/node';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { mergeAlias } from 'vite';

export default defineMain({
  framework: '@storybook/react-vite',
  stories: ['../src/renderer/src/**/*.stories.tsx'],
  addons: [
    '@storybook/addon-a11y',
    '@storybook/addon-vitest',
    '@storybook/addon-themes',
    '@storybook/addon-mcp',
  ],
  typescript: {
    reactDocgen: 'react-docgen',
  },
  viteFinal: (config) => ({
    ...config,
    resolve: {
      ...config.resolve,
      alias:
        mergeAlias(config.resolve?.alias, {
          '@renderer': resolve(import.meta.dirname, '../src/renderer/src'),
        }) ?? {},
    },
    plugins: [...(config.plugins ?? []), tailwindcss()],
  }),
});
