import { defineConfig } from 'vitest/config';

import { coverageDefaults, repositoryRoot } from '../../vitest.shared';

export default defineConfig({
  test: {
    reporters: ['default', ['tdd-guard-vitest', { projectRoot: repositoryRoot }]],
    environment: 'node',
    include: ['src/**/*.test.ts'],
    typecheck: {
      enabled: true,
      include: ['src/**/*.test-d.ts'],
    },
    coverage: {
      ...coverageDefaults,
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test-d.ts'],
    },
  },
});
