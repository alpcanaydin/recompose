import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defaultExclude, defineConfig } from 'vitest/config';

import { coverageDefaults } from '../../vitest.shared';

const chromium = () => ({
  enabled: true,
  headless: true,
  provider: playwright({
    contextOptions: { permissions: ['clipboard-read', 'clipboard-write'] },
  }),
  instances: [{ browser: 'chromium' as const }],
});

export default defineConfig({
  test: {
    coverage: {
      ...coverageDefaults,
      include: ['src/**/*.{ts,tsx}', 'scripts/**/*.mts'],
      exclude: [
        'src/**/*.test.*',
        'src/**/*.browser.test.*',
        'scripts/**/*.test.mts',
        'scripts/generate-icons.mts',
        'src/renderer/src/shared/testing/**',
        'src/**/*.d.ts',
        'src/main/index.ts',
        'src/main/engine-host/spawn-engine.ts',
        'src/main/ipc/register-ipc.ts',
        'src/main/menu/app-menu.ts',
        'src/main/protocol/app-protocol.ts',
        'src/main/tray/menu-bar-tray.ts',
        'src/main/windows/main-window.ts',
        'src/preload/index.ts',
        'src/renderer/src/app/main.tsx',
        'src/renderer/src/app/routeTree.gen.ts',
        'src/**/*.stories.tsx',
      ],
    },
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mts'],
          exclude: [...defaultExclude, '**/*.browser.test.*'],
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'browser',
          include: ['src/renderer/**/*.browser.test.{ts,tsx}'],
          browser: chromium(),
        },
      },
      {
        plugins: [storybookTest({ configDir: '.storybook' })],
        test: {
          name: 'storybook',
          browser: chromium(),
        },
      },
      {
        plugins: [storybookTest({ configDir: '.storybook', initialGlobals: { theme: 'dark' } })],
        test: {
          name: 'storybook-dark',
          browser: chromium(),
        },
      },
    ],
  },
});
