import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';
import { resolve } from 'path';

import { injectContentSecurityPolicy } from './src/renderer/csp-policy';

function cspTransform() {
  return {
    name: 'recompose-csp',
    transformIndexHtml(html: string, ctx: { server?: unknown }) {
      const mode = ctx.server === undefined ? 'build' : 'serve';

      return injectContentSecurityPolicy(html, mode);
    },
  };
}

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
      },
    },
    plugins: [
      tanstackRouter({
        target: 'react',
        routesDirectory: './src/app/routes',
        generatedRouteTree: './src/app/routeTree.gen.ts',
      }),
      cspTransform(),
      react(),
      tailwindcss(),
    ],
  },
});
