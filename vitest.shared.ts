import type { CoverageOptions } from 'vitest/node';

export const coverageDefaults: CoverageOptions = {
  provider: 'v8',
  reporter: ['text', 'lcov'],
  thresholds: {
    lines: 90,
    branches: 90,
    functions: 90,
    statements: 90,
  },
};
