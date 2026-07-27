import { defineConfig, enforceTdd } from '@nizos/probity';

export default defineConfig({
  rules: [
    {
      files: [
        'apps/*/src/**',
        'packages/*/src/**',
        '!**/*.css',
        '!**/*.html',
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
