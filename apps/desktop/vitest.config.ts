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
    ],
  },
});
