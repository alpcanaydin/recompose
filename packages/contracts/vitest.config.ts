import { defineConfig } from 'vitest/config';

import { coverageDefaults } from '../../vitest.shared';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      ...coverageDefaults,
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
    },
  },
});
