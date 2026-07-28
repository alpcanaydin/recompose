import { defineConfig, enforceTdd } from '@nizos/probity';

export default defineConfig({
  rules: [
    {
      files: [
        'apps/*/src/**',
        'packages/*/src/**',
        '!**/*.css',
        '!**/*.html',
        '!**/*.test.*',
        '!**/*.spec.*',
        '!**/*.test-d.*',
        '!**/*.stories.*',
        '!**/*.gen.*',
      ],
      rules: [enforceTdd()],
    },
  ],
});
