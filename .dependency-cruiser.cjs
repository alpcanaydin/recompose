module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'renderer-isolated',
      severity: 'error',
      from: { path: '^apps/desktop/src/renderer/' },
      to: {
        path: '^apps/desktop/src/(main|preload)/',
        pathNot: '^apps/desktop/src/preload/index\\.d\\.ts$',
      },
    },
    {
      name: 'main-not-into-renderer',
      severity: 'error',
      from: { path: '^apps/desktop/src/main/' },
      to: { path: '^apps/desktop/src/renderer/' },
    },
    {
      name: 'preload-isolated',
      severity: 'error',
      from: { path: '^apps/desktop/src/preload/' },
      to: { path: '^apps/desktop/src/(main|renderer)/' },
    },
    {
      name: 'engine-no-electron',
      severity: 'error',
      from: { path: '^packages/engine/' },
      to: { path: '^electron(/|$)|(^|/)node_modules/electron(/|$)' },
    },
    {
      name: 'engine-only-contracts',
      severity: 'error',
      from: { path: '^packages/engine/' },
      to: {
        path: '^(apps|packages)/',
        pathNot: '^packages/(engine|contracts)/',
      },
    },
    {
      name: 'desktop-not-into-engine',
      severity: 'error',
      from: { path: '^apps/desktop/' },
      to: { path: '^packages/engine/' },
    },
    {
      name: 'headless-scope',
      severity: 'error',
      from: { path: '^apps/headless/' },
      to: {
        path: '^(apps|packages)/',
        pathNot: '^(apps/headless|packages/(engine|contracts))/',
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'apps/desktop/tsconfig.web.json' },
  },
};
