import { defineConfig, enforceTdd } from '@nizos/probity';

export default defineConfig({
  rules: [
    {
      files: [
        'apps/desktop/src/**/*.ts',
        'apps/desktop/src/**/*.tsx',
        'packages/contracts/src/**/*.ts',
        '!**/*.test.ts',
        '!**/*.test.tsx',
        '!**/*.test-d.ts',
        '!**/*.stories.tsx',
        '!**/*.gen.ts',
      ],
      rules: [enforceTdd()],
    },
  ],
});
