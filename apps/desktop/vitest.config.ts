import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defaultExclude, defineConfig } from 'vitest/config';

import { coverageDefaults } from '../../vitest.shared';

export default defineConfig({
  test: {
    coverage: {
      ...coverageDefaults,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.*',
        'src/**/*.browser.test.*',
        'src/**/*.d.ts',
        'src/main/index.ts',
        'src/main/ipc/register-ipc.ts',
        'src/main/protocol/app-protocol.ts',
        'src/main/windows/main-window.ts',
        'src/preload/index.ts',
        'src/renderer/src/app/main.tsx',
        'src/renderer/src/app/routeTree.gen.ts',
      ],
    },
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: [...defaultExclude, '**/*.browser.test.*'],
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'browser',
          include: ['src/renderer/**/*.browser.test.{ts,tsx}'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
