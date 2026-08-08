import { defineConfig } from 'vitest/config';

import { coverageDefaults } from '../../vitest.shared';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    typecheck: {
      enabled: true,
      include: ['src/**/*.test-d.ts'],
    },
    coverage: {
      ...coverageDefaults,
      thresholds: { lines: 95, branches: 95, functions: 95, statements: 95 },
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test-d.ts'],
    },
  },
});
