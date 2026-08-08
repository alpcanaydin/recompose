import type { CoverageOptions } from 'vitest/node';

export const coverageDefaults: CoverageOptions = {
  provider: 'v8',
  reporter: ['text', 'lcov'],
  thresholds: {
    lines: 95,
    branches: 95,
    functions: 95,
    statements: 95,
  },
};
