import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defaultExclude, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
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
          include: ['src/renderer/**/*.browser.test.tsx'],
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
