import type { CoverageOptions } from 'vitest/node';

import { fileURLToPath } from 'node:url';

export const repositoryRoot = fileURLToPath(new URL('.', import.meta.url));

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
