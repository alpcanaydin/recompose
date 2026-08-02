import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

export default defineConfig([
  ...fsd.configs.recommended,
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'fsd/forbidden-imports': 'off',
    },
  },
]);
