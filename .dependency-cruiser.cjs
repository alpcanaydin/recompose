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
      name: 'renderer-isolated-transitive',
      severity: 'error',
      from: { path: '^apps/desktop/src/renderer/' },
      to: {
        path: '^apps/desktop/src/(main|preload)/',
        pathNot: '^apps/desktop/src/preload/index\\.d\\.ts$',
        reachable: true,
      },
    },
    {
      name: 'main-not-into-renderer',
      severity: 'error',
      from: { path: '^apps/desktop/src/main/' },
      to: { path: '^apps/desktop/src/renderer/' },
    },
    {
      name: 'main-not-into-renderer-transitive',
      severity: 'error',
      from: { path: '^apps/desktop/src/main/' },
      to: { path: '^apps/desktop/src/renderer/', reachable: true },
    },
    {
      name: 'preload-isolated',
      severity: 'error',
      from: { path: '^apps/desktop/src/preload/' },
      to: { path: '^apps/desktop/src/(main|renderer)/' },
    },
    {
      name: 'preload-isolated-transitive',
      severity: 'error',
      from: { path: '^apps/desktop/src/preload/' },
      to: { path: '^apps/desktop/src/(main|renderer)/', reachable: true },
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
    {
      name: 'no-phantom-deps',
      severity: 'error',
      from: {},
      to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown'] },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true, pathNot: ['\\?asset$'] },
    },
    {
      name: 'no-orphans',
      severity: 'error',
      from: {
        orphan: true,
        pathNot: [
          '\\.d\\.ts$',
          '\\.test\\.(ts|tsx)$',
          '\\.browser\\.test\\.tsx$',
          '(^|/)src/main/index\\.ts$',
          '(^|/)src/preload/index\\.ts$',
          '(^|/)src/app/main\\.tsx$',
        ],
      },
      to: {},
    },
    {
      name: 'not-to-test',
      severity: 'error',
      from: { pathNot: ['\\.test\\.(ts|tsx)$', '\\.browser\\.test\\.tsx$'] },
      to: { path: ['\\.test\\.(ts|tsx)$', '\\.browser\\.test\\.tsx$'] },
    },
    {
      name: 'no-deprecated-core',
      severity: 'error',
      from: {},
      to: {
        dependencyTypes: ['core'],
        path: ['^punycode$', '^domain$', '^constants$', '^sys$', '^_linklist$', '^_stream_wrap$'],
      },
    },
    {
      name: 'no-duplicate-dep-types',
      severity: 'error',
      from: {},
      to: { moreThanOneDependencyType: true, dependencyTypesNot: ['type-only'] },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(out|coverage|storybook-static)/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'apps/desktop/tsconfig.web.json' },
    enhancedResolveOptions: {
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      exportsFields: ['exports'],
    },
  },
};
