import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  // @ts-expect-error Vite's OxcOptions type omits tsconfig; runtime still honors it to skip broken sandboxed tsconfig auto-discovery.
  oxc: { tsconfig: false },
});
