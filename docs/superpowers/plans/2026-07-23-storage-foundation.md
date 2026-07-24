# Storage foundation implementation plan

> **For agentic workers:** This plan requires the sub-skill superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement it task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open `packages/contracts` with the schemaVersion'd zod schemas and migration framework for all on-disk documents. Give the desktop main process its storage services (gateway configs, accounts, settings, vault) with atomic writes and corrupt-file quarantine.

**Architecture:** Pure schema/migration logic lives in `packages/contracts` (source-exports workspace package, no build step, since vite and vitest consume TS directly). The desktop main process gets thin fs shells under a `src/main/windows`-style module, `src/main/storage/`, booted by one `initializeStorage` call from the entry wiring. Engine-side pieces (usage.db recorder, config/secret handoff messaging) wait until `packages/engine` opens. The vault's safeStorage codec is the only electron-touching file, and callers inject it everywhere else.

**Tech Stack:** zod 4.4.3, vitest 4.1.10, fast-check 4.9.0 + @fast-check/vitest 0.4.1, Electron safeStorage.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-23-storage-design.md`.
- Exact pins, no ranges (workspace convention): zod 4.4.3. devDependencies mirror apps/desktop's pins: typescript 7.0.2, vitest 4.1.10, fast-check 4.9.0, @fast-check/vitest 0.4.1, oxlint 1.74.0, oxlint-tsgolint 0.25.0. Workspace references use `workspace:*`.
- `packages/contracts` opens this job → the boundary scan gains the argument: root `package.json` script `lint:boundaries` becomes `depcruise apps packages` (the follow-up Architecture Decision Record (ADR) 0014 recorded). All pre-staged package rules bind automatically.
- Coverage gate applies to the new package: its vitest config spreads `coverageDefaults` from the root `vitest.shared.ts` (thresholds live only there).
- Filename boundary: node-env tests are `*.test.ts`, colocated with source. No DOM here, so no browser-mode tests.
- Secrets never appear in gateway/accounts/settings JSON, only `credentialRef` strings.
- Single-writer: these services are main-process-only, and nothing here spawns processes or registers Inter-Process Communication (IPC).
- Test-Driven Development (TDD): failing test first for every behavior. State-based assertions, with test doubles only at process boundaries (fs via temp dirs is real, electron's safeStorage is the one mocked boundary).
- TypeScript max strictness, with no `any` and no silencing `as`.
- **Never write code comments.**
- The repository owner's private alias must not appear in any artifact.
- Commit messages: Conventional Commits, terse, imperative, with trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Pre-commit hooks run gitleaks/lint/fmt/typecheck plus boundaries/fsd/dead gates, and oxfmt may reformat and stage fixes automatically. If the first commit in a fresh worktree fails with `oxfmt: No such file or directory`, run `pnpm install` once and retry.
- All commands run from the worktree root. Shell may be fish: check exit codes with `echo "exit: $status"`, never after a pipe.

---

### Task 1: Open `packages/contracts` with the migration framework

**Files:**

- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/vitest.config.ts`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/migration.ts`
- Test: `packages/contracts/src/migration.test.ts`
- Modify: root `package.json` (`lint:boundaries` script gains `packages`)

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: package `@recompose/contracts` importable as workspace dep; `migrateDocument(doc: unknown, migrations: readonly Migration[], currentVersion: number): unknown` and `type Migration = { from: number; migrate: (doc: Record<string, unknown>) => Record<string, unknown> }` re-exported from `src/index.ts`. Later tasks add schema modules to the same package and re-export from `src/index.ts`.

- [ ] **Step 1: Scaffold the package**

Create `packages/contracts/package.json`:

```json
{
  "name": "@recompose/contracts",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "lint": "oxlint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --coverage"
  },
  "dependencies": {
    "zod": "4.4.3"
  },
  "devDependencies": {
    "@fast-check/vitest": "0.4.1",
    "@vitest/coverage-v8": "4.1.10",
    "fast-check": "4.9.0",
    "oxlint": "1.74.0",
    "oxlint-tsgolint": "0.25.0",
    "typescript": "7.0.2",
    "vitest": "4.1.10"
  }
}
```

Create `packages/contracts/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.strict.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022",
    "lib": ["ES2022"],
    "noEmit": true
  },
  "include": ["src/**/*", "vitest.config.ts", "../../vitest.shared.ts"]
}
```

Create `packages/contracts/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

import { coverageDefaults } from '../../vitest.shared';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      ...coverageDefaults,
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
    },
  },
});
```

Create `packages/contracts/src/index.ts`:

```ts
export * from './migration';
```

Run: `pnpm install`
Expected: lockfile gains the new importer, with no errors. All versions already exist in the store, so every pin's presence in the lockfile satisfies `minimumReleaseAge`.

- [ ] **Step 2: Write the failing migration specs (examples + property)**

Create `packages/contracts/src/migration.test.ts`:

```ts
import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import { migrateDocument, type Migration } from './migration';

const renameTitleToName: Migration = {
  from: 1,
  migrate: (doc) => {
    const { title, ...rest } = doc;
    return { ...rest, name: title, schemaVersion: 2 };
  },
};

const addCreatedFlag: Migration = {
  from: 2,
  migrate: (doc) => ({ ...doc, created: true, schemaVersion: 3 }),
};

describe('document migration', () => {
  test('a current-version document passes through untouched', () => {
    const doc = { schemaVersion: 3, name: 'x', created: true };

    const result = migrateDocument(doc, [renameTitleToName, addCreatedFlag], 3);

    expect(result).toEqual(doc);
  });

  test('an old document is migrated stepwise to the current version', () => {
    const result = migrateDocument(
      { schemaVersion: 1, title: 'legacy' },
      [renameTitleToName, addCreatedFlag],
      3,
    );

    expect(result).toEqual({ schemaVersion: 3, name: 'legacy', created: true });
  });

  test('a document without an integer schemaVersion is rejected', () => {
    expect(() => migrateDocument({ name: 'x' }, [], 1)).toThrow(/schemaVersion/);
    expect(() => migrateDocument({ schemaVersion: 'one' }, [], 1)).toThrow(/schemaVersion/);
    expect(() => migrateDocument(null, [], 1)).toThrow(/schemaVersion/);
  });

  test('a document newer than the current version is rejected', () => {
    expect(() =>
      migrateDocument({ schemaVersion: 4 }, [renameTitleToName, addCreatedFlag], 3),
    ).toThrow(/newer/);
  });

  test('a version gap with no covering migration is rejected', () => {
    expect(() => migrateDocument({ schemaVersion: 1 }, [addCreatedFlag], 3)).toThrow(/migration/);
  });

  const anyStartVersion = fc.integer({ min: 1, max: 3 });

  test.prop([anyStartVersion])(
    'every historical version reaches the current version through the chain',
    (startVersion) => {
      const doc = { schemaVersion: startVersion, title: 'seed', name: 'seed', created: false };

      const result = migrateDocument(doc, [renameTitleToName, addCreatedFlag], 3);

      expect((result as { schemaVersion: number }).schemaVersion).toBe(3);
    },
  );
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm --filter @recompose/contracts run test`
Expected: `FAIL`, since the test can't resolve `./migration`.

- [ ] **Step 4: Implement**

Create `packages/contracts/src/migration.ts`:

```ts
export type Migration = {
  from: number;
  migrate: (doc: Record<string, unknown>) => Record<string, unknown>;
};

function readSchemaVersion(doc: unknown): number {
  if (typeof doc !== 'object' || doc === null || !('schemaVersion' in doc)) {
    throw new Error('document has no schemaVersion');
  }
  const version = (doc as Record<string, unknown>)['schemaVersion'];
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new Error('schemaVersion must be a positive integer');
  }
  return version;
}

export function migrateDocument(
  doc: unknown,
  migrations: readonly Migration[],
  currentVersion: number,
): unknown {
  let version = readSchemaVersion(doc);
  if (version > currentVersion) {
    throw new Error(`document schemaVersion ${version} is newer than supported ${currentVersion}`);
  }
  let migrated = doc as Record<string, unknown>;
  while (version < currentVersion) {
    const step = migrations.find((candidate) => candidate.from === version);
    if (step === undefined) {
      throw new Error(`no migration from schemaVersion ${version}`);
    }
    migrated = step.migrate(migrated);
    version = readSchemaVersion(migrated);
  }
  return migrated;
}
```

- [ ] **Step 5: Run to verify pass**

Run: `pnpm --filter @recompose/contracts run test`
Expected: `PASS`: 6 specs, coverage 100% on `migration.ts` (index.ts re-export counts via import).

- [ ] **Step 6: Extend the boundary scan to packages**

In the root `package.json`, change the script:

```json
    "lint:boundaries": "depcruise apps packages",
```

Run: `pnpm run lint:boundaries; echo "exit: $status"`
Expected: `exit: 0`. The module count grows by the contracts files, with no violations (contracts imports nothing from the workspace).

Run: `pnpm run lint:dead; echo "exit: $status"`
Expected: `exit: 0`. If knip flags the new workspace (for example, an unused index export before Task 4 consumes it), the test files consuming the exports should already satisfy it. If a workspace-level knip entry is genuinely needed, add the narrowest possible block to `knip.json` (`"packages/contracts": {}`). Never use a broad ignore.

Run: `pnpm run typecheck && pnpm run lint && pnpm test`
Expected: turbo now runs 2 packages for each task, all green.

- [ ] **Step 7: Commit**

```bash
git add packages/contracts pnpm-lock.yaml package.json knip.json
git commit -m "feat(contracts): open package with document migration framework"
```

---

### Task 2: Gateway config schema v1 with round-trip properties

**Files:**

- Create: `packages/contracts/src/gateway-config.ts`
- Test: `packages/contracts/src/gateway-config.test.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**

- Consumes: `migrateDocument`, `Migration` from Task 1.
- Produces: `GATEWAY_CONFIG_VERSION = 1`; `gatewayConfigSchema` (zod); types `GatewayConfig`, `RoutingNode`; `loadGatewayConfig(doc: unknown): GatewayConfig` (migrate → validate); `gatewaySlugSchema` (shared slug rule). All re-exported from `src/index.ts`.

- [ ] **Step 1: Write the failing specs**

Create `packages/contracts/src/gateway-config.test.ts`:

```ts
import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import { GATEWAY_CONFIG_VERSION, gatewayConfigSchema, loadGatewayConfig } from './gateway-config';

const validTarget = {
  kind: 'target' as const,
  id: 't1',
  accountId: 'acc-claude-max',
  providerModel: 'claude-sonnet-5',
  weight: 100,
};

const validConfig = {
  schemaVersion: GATEWAY_CONFIG_VERSION,
  slug: 'my-gateway',
  displayName: 'My Gateway',
  virtualModels: [
    {
      id: 'vm1',
      slug: 'fast',
      displayName: 'fast',
      routing: {
        kind: 'router' as const,
        id: 'r1',
        mode: 'failover' as const,
        children: [validTarget, { ...validTarget, id: 't2', weight: 0 }],
      },
    },
  ],
  layout: {
    nodes: { gateway: { x: 0, y: 0 }, vm1: { x: 240, y: 0 } },
  },
};

describe('gateway config schema', () => {
  test('a canonical config parses and keeps its shape', () => {
    const parsed = gatewayConfigSchema.parse(validConfig);

    expect(parsed).toEqual(validConfig);
  });

  test('a virtual model may route straight to a single target', () => {
    const direct = {
      ...validConfig,
      virtualModels: [{ id: 'vm1', slug: 'code', displayName: 'code', routing: validTarget }],
    };

    expect(gatewayConfigSchema.parse(direct).virtualModels[0]?.routing.kind).toBe('target');
  });

  test('routers chain: a router child may itself be a router', () => {
    const nested = {
      ...validConfig,
      virtualModels: [
        {
          id: 'vm1',
          slug: 'fast',
          displayName: 'fast',
          routing: {
            kind: 'router' as const,
            id: 'outer',
            mode: 'round-robin' as const,
            children: [
              validTarget,
              {
                kind: 'router' as const,
                id: 'inner',
                mode: 'failover' as const,
                children: [{ ...validTarget, id: 't3' }],
              },
            ],
          },
        },
      ],
    };

    expect(() => gatewayConfigSchema.parse(nested)).not.toThrow();
  });

  test('secrets cannot hide in a config: unknown keys are rejected', () => {
    expect(() => gatewayConfigSchema.parse({ ...validConfig, apiKey: 'sk-oops' })).toThrow();
  });

  test('invalid slugs are rejected', () => {
    for (const bad of ['My Gateway', 'UPPER', '-lead', 'trail-', 'a--b', '']) {
      expect(() => gatewayConfigSchema.parse({ ...validConfig, slug: bad })).toThrow();
    }
  });

  test('a router needs at least one child', () => {
    const empty = {
      ...validConfig,
      virtualModels: [
        {
          id: 'vm1',
          slug: 'fast',
          displayName: 'fast',
          routing: { kind: 'router' as const, id: 'r1', mode: 'failover' as const, children: [] },
        },
      ],
    };

    expect(() => gatewayConfigSchema.parse(empty)).toThrow();
  });

  test('loadGatewayConfig validates after migration', () => {
    expect(loadGatewayConfig(validConfig)).toEqual(validConfig);
    expect(() => loadGatewayConfig({ schemaVersion: 99 })).toThrow(/newer/);
    expect(() => loadGatewayConfig({ schemaVersion: 1, slug: 'x!' })).toThrow();
  });
});

const slugArb = fc
  .stringMatching(/^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,30}$/)
  .filter((value) => value.length > 0);

const targetArb = fc.record({
  kind: fc.constant('target' as const),
  id: fc.uuid(),
  accountId: slugArb,
  providerModel: fc.stringMatching(/^[a-z0-9][a-z0-9.-]{0,40}$/),
  weight: fc.integer({ min: 0, max: 100 }),
});

const routingArb = fc.letrec((tie) => ({
  node: fc.oneof(
    { maxDepth: 3, withCrossShrink: true },
    targetArb,
    fc.record({
      kind: fc.constant('router' as const),
      id: fc.uuid(),
      mode: fc.constantFrom('failover' as const, 'round-robin' as const),
      children: fc.array(tie('node'), { minLength: 1, maxLength: 3 }),
    }),
  ),
})).node;

const configArb = fc.record({
  schemaVersion: fc.constant(GATEWAY_CONFIG_VERSION),
  slug: slugArb,
  displayName: fc
    .string({ minLength: 1, maxLength: 40 })
    .filter((value) => value.trim().length > 0),
  virtualModels: fc.array(
    fc.record({
      id: fc.uuid(),
      slug: slugArb,
      displayName: fc
        .string({ minLength: 1, maxLength: 40 })
        .filter((value) => value.trim().length > 0),
      routing: routingArb,
    }),
    { minLength: 1, maxLength: 4 },
  ),
  layout: fc.record({
    nodes: fc.dictionary(
      fc.string({ minLength: 1, maxLength: 20 }),
      fc.record({
        x: fc.integer({ min: -10000, max: 10000 }),
        y: fc.integer({ min: -10000, max: 10000 }),
      }),
    ),
  }),
});

describe('gateway config round-trip', () => {
  test.prop([configArb])('any valid config survives serialize → parse identically', (config) => {
    const roundTripped = loadGatewayConfig(JSON.parse(JSON.stringify(config)));

    expect(roundTripped).toEqual(config);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @recompose/contracts run test`
Expected: `FAIL`, since the test can't resolve `./gateway-config`.

- [ ] **Step 3: Implement**

Create `packages/contracts/src/gateway-config.ts`:

```ts
import { z } from 'zod';

import { migrateDocument, type Migration } from './migration';

export const GATEWAY_CONFIG_VERSION = 1;

export const gatewaySlugSchema = z
  .string()
  .regex(/^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9]))*$/, 'lowercase slug with single dashes');

const targetSchema = z.strictObject({
  kind: z.literal('target'),
  id: z.string().min(1),
  accountId: z.string().min(1),
  providerModel: z.string().min(1),
  weight: z.int().min(0).max(100),
});

export type RoutingNode =
  | z.infer<typeof targetSchema>
  | {
      kind: 'router';
      id: string;
      mode: 'failover' | 'round-robin';
      children: RoutingNode[];
    };

const routingNodeSchema: z.ZodType<RoutingNode> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    targetSchema,
    z.strictObject({
      kind: z.literal('router'),
      id: z.string().min(1),
      mode: z.enum(['failover', 'round-robin']),
      children: z.array(routingNodeSchema).min(1),
    }),
  ]),
);

const virtualModelSchema = z.strictObject({
  id: z.string().min(1),
  slug: gatewaySlugSchema,
  displayName: z.string().trim().min(1),
  routing: routingNodeSchema,
});

const layoutSchema = z.strictObject({
  nodes: z.record(z.string().min(1), z.strictObject({ x: z.number(), y: z.number() })),
  viewport: z
    .strictObject({ x: z.number(), y: z.number(), zoom: z.number().positive() })
    .optional(),
});

export const gatewayConfigSchema = z.strictObject({
  schemaVersion: z.literal(GATEWAY_CONFIG_VERSION),
  slug: gatewaySlugSchema,
  displayName: z.string().trim().min(1),
  virtualModels: z.array(virtualModelSchema).min(1),
  layout: layoutSchema,
});

export type GatewayConfig = z.infer<typeof gatewayConfigSchema>;

const gatewayConfigMigrations: readonly Migration[] = [];

export function loadGatewayConfig(doc: unknown): GatewayConfig {
  return gatewayConfigSchema.parse(
    migrateDocument(doc, gatewayConfigMigrations, GATEWAY_CONFIG_VERSION),
  );
}
```

Append to `packages/contracts/src/index.ts`:

```ts
export * from './gateway-config';
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @recompose/contracts run test`
Expected: `PASS`. All specs pass, including the property (100 generated configs), and coverage is green. If zod 4's API names differ from the snippet (`z.strictObject`, `z.int`), consult the installed `node_modules/zod` typings and use the current equivalents. Never loosen a constraint to pass.

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm --filter @recompose/contracts run typecheck`
Expected: `PASS`.

```bash
git add packages/contracts
git commit -m "feat(contracts): gateway config schema v1 with routing tree"
```

---

### Task 3: Accounts and settings schemas

**Files:**

- Create: `packages/contracts/src/accounts.ts`
- Create: `packages/contracts/src/settings.ts`
- Test: `packages/contracts/src/accounts.test.ts`
- Test: `packages/contracts/src/settings.test.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**

- Consumes: `migrateDocument`, `Migration` (Task 1); `gatewaySlugSchema` (Task 2).
- Produces: `ACCOUNTS_VERSION = 1`, `accountsDocumentSchema`, `AccountsDocument`, `loadAccountsDocument(doc: unknown): AccountsDocument`, `defaultAccountsDocument(): AccountsDocument`; `SETTINGS_VERSION = 1`, `settingsSchema`, `Settings`, `loadSettings(doc: unknown): Settings`, `defaultSettings(): Settings`. All re-exported from `src/index.ts`.

- [ ] **Step 1: Write the failing specs**

Create `packages/contracts/src/accounts.test.ts`:

```ts
import { describe, expect, test } from 'vitest';

import { defaultAccountsDocument, loadAccountsDocument } from './accounts';

const validDoc = {
  schemaVersion: 1,
  accounts: [
    {
      id: 'acc-claude-max',
      provider: 'anthropic',
      kind: 'subscription',
      label: 'Claude Max',
      credentialRef: 'cred-7f3a',
    },
  ],
};

describe('accounts registry', () => {
  test('a canonical registry parses and keeps its shape', () => {
    expect(loadAccountsDocument(validDoc)).toEqual(validDoc);
  });

  test('the default registry is empty and current-version', () => {
    expect(defaultAccountsDocument()).toEqual({ schemaVersion: 1, accounts: [] });
  });

  test('an account never carries a raw secret field', () => {
    const smuggled = {
      ...validDoc,
      accounts: [{ ...validDoc.accounts[0], apiKey: 'sk-oops' }],
    };

    expect(() => loadAccountsDocument(smuggled)).toThrow();
  });

  test('account kinds are the three provider surfaces', () => {
    for (const kind of ['subscription', 'api-key', 'aggregator']) {
      const doc = { ...validDoc, accounts: [{ ...validDoc.accounts[0], kind }] };
      expect(() => loadAccountsDocument(doc)).not.toThrow();
    }
    const invalid = { ...validDoc, accounts: [{ ...validDoc.accounts[0], kind: 'oauth' }] };
    expect(() => loadAccountsDocument(invalid)).toThrow();
  });

  test('duplicate account ids are rejected', () => {
    const doubled = { ...validDoc, accounts: [validDoc.accounts[0], validDoc.accounts[0]] };

    expect(() => loadAccountsDocument(doubled)).toThrow(/duplicate/i);
  });
});
```

Create `packages/contracts/src/settings.test.ts`:

```ts
import { describe, expect, test } from 'vitest';

import { defaultSettings, loadSettings } from './settings';

describe('app settings', () => {
  test('defaults: system theme, engine on 8397', () => {
    expect(defaultSettings()).toEqual({ schemaVersion: 1, theme: 'system', enginePort: 8397 });
  });

  test('a stored settings file parses and keeps its shape', () => {
    const stored = { schemaVersion: 1, theme: 'dark', enginePort: 9000 };

    expect(loadSettings(stored)).toEqual(stored);
  });

  test('ports outside the unprivileged range are rejected', () => {
    for (const port of [0, 80, 1023, 65536]) {
      expect(() => loadSettings({ schemaVersion: 1, theme: 'system', enginePort: port })).toThrow();
    }
  });

  test('unknown keys are rejected', () => {
    expect(() =>
      loadSettings({ schemaVersion: 1, theme: 'system', enginePort: 8397, telemetry: true }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @recompose/contracts run test`
Expected: `FAIL`, since the test can't resolve `./accounts` and `./settings`.

- [ ] **Step 3: Implement**

Create `packages/contracts/src/accounts.ts`:

```ts
import { z } from 'zod';

import { migrateDocument, type Migration } from './migration';

export const ACCOUNTS_VERSION = 1;

const accountSchema = z.strictObject({
  id: z.string().min(1),
  provider: z.string().min(1),
  kind: z.enum(['subscription', 'api-key', 'aggregator']),
  label: z.string().trim().min(1),
  credentialRef: z.string().min(1),
});

export const accountsDocumentSchema = z
  .strictObject({
    schemaVersion: z.literal(ACCOUNTS_VERSION),
    accounts: z.array(accountSchema),
  })
  .refine(
    (doc) => new Set(doc.accounts.map((account) => account.id)).size === doc.accounts.length,
    { message: 'duplicate account id' },
  );

export type AccountsDocument = z.infer<typeof accountsDocumentSchema>;

const accountsMigrations: readonly Migration[] = [];

export function loadAccountsDocument(doc: unknown): AccountsDocument {
  return accountsDocumentSchema.parse(migrateDocument(doc, accountsMigrations, ACCOUNTS_VERSION));
}

export function defaultAccountsDocument(): AccountsDocument {
  return { schemaVersion: ACCOUNTS_VERSION, accounts: [] };
}
```

Create `packages/contracts/src/settings.ts`:

```ts
import { z } from 'zod';

import { migrateDocument, type Migration } from './migration';

export const SETTINGS_VERSION = 1;

export const settingsSchema = z.strictObject({
  schemaVersion: z.literal(SETTINGS_VERSION),
  theme: z.enum(['system', 'light', 'dark']),
  enginePort: z.int().min(1024).max(65535),
});

export type Settings = z.infer<typeof settingsSchema>;

const settingsMigrations: readonly Migration[] = [];

export function loadSettings(doc: unknown): Settings {
  return settingsSchema.parse(migrateDocument(doc, settingsMigrations, SETTINGS_VERSION));
}

export function defaultSettings(): Settings {
  return { schemaVersion: SETTINGS_VERSION, theme: 'system', enginePort: 8397 };
}
```

Append to `packages/contracts/src/index.ts`:

```ts
export * from './accounts';
export * from './settings';
```

- [ ] **Step 4: Run to verify pass, then commit**

Run: `pnpm --filter @recompose/contracts run test && pnpm --filter @recompose/contracts run typecheck`
Expected: `PASS`, coverage green.

```bash
git add packages/contracts
git commit -m "feat(contracts): accounts registry and settings schemas"
```

---

### Task 4: Desktop storage services (json shell, stores, boot init)

**Files:**

- Modify: `apps/desktop/package.json` (dependency `@recompose/contracts`)
- Create: `apps/desktop/src/main/storage/json-file.ts`
- Create: `apps/desktop/src/main/storage/gateway-store.ts`
- Create: `apps/desktop/src/main/storage/settings-store.ts`
- Create: `apps/desktop/src/main/storage/accounts-store.ts`
- Create: `apps/desktop/src/main/storage/initialize-storage.ts`
- Test: `apps/desktop/src/main/storage/json-file.test.ts`
- Test: `apps/desktop/src/main/storage/gateway-store.test.ts`
- Test: `apps/desktop/src/main/storage/settings-store.test.ts`
- Test: `apps/desktop/src/main/storage/accounts-store.test.ts`
- Test: `apps/desktop/src/main/storage/initialize-storage.test.ts`
- Modify: `apps/desktop/src/main/index.ts` (one boot call)

**Interfaces:**

- Consumes: from `@recompose/contracts`: `loadGatewayConfig`, `GatewayConfig`, `loadAccountsDocument`, `defaultAccountsDocument`, `AccountsDocument`, `loadSettings`, `defaultSettings`, `Settings`.
- Produces: `writeJsonAtomic(filePath: string, value: unknown): Promise<void>`; `readJsonWithQuarantine(filePath: string, onCorrupt: (quarantinedPath: string) => void): Promise<unknown | undefined>` (undefined = file absent; corrupt file renamed to `<name>.corrupt-<ISO timestamp with colons replaced by dashes>` and reported); `listGatewayConfigs(dir, onCorrupt): Promise<GatewayConfig[]>`; `saveGatewayConfig(dir, config): Promise<void>` (path `<dir>/<slug>.json`); `loadSettingsFile(filePath, onCorrupt): Promise<Settings>` (defaults when absent); `saveSettingsFile(filePath, settings)`; `loadAccountsFile(filePath, onCorrupt): Promise<AccountsDocument>` (defaults when absent); `saveAccountsFile(filePath, accounts)`; `initializeStorage(userDataPath, onCorrupt): Promise<{ settings: Settings; accounts: AccountsDocument; gateways: GatewayConfig[] }>` (creates `gateways/` dir, loads everything).

- [ ] **Step 1: Add the workspace dependency**

```bash
pnpm --filter @recompose/desktop add "@recompose/contracts@workspace:*"
```

- [ ] **Step 2: Write the failing json-shell specs**

Create `apps/desktop/src/main/storage/json-file.test.ts`:

```ts
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import { readJsonWithQuarantine, writeJsonAtomic } from './json-file';

async function freshDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'recompose-storage-'));
}

describe('json file shell', () => {
  test('a written document reads back identically', async () => {
    const dir = await freshDir();
    const file = join(dir, 'doc.json');

    await writeJsonAtomic(file, { a: 1, nested: { b: 'two' } });

    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ a: 1, nested: { b: 'two' } });
  });

  test('writing leaves no temporary files behind', async () => {
    const dir = await freshDir();

    await writeJsonAtomic(join(dir, 'doc.json'), { a: 1 });

    expect(await readdir(dir)).toEqual(['doc.json']);
  });

  test('an absent file reads as undefined without invoking quarantine', async () => {
    const dir = await freshDir();
    const seen: string[] = [];

    const result = await readJsonWithQuarantine(join(dir, 'missing.json'), (p) => seen.push(p));

    expect(result).toBeUndefined();
    expect(seen).toEqual([]);
  });

  test('a corrupt file is quarantined aside and reported, not deleted', async () => {
    const dir = await freshDir();
    const file = join(dir, 'doc.json');
    await writeFile(file, '{ not json', 'utf8');
    const seen: string[] = [];

    const result = await readJsonWithQuarantine(file, (p) => seen.push(p));

    expect(result).toBeUndefined();
    expect(seen).toHaveLength(1);
    const entries = await readdir(dir);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatch(/^doc\.json\.corrupt-/);
    expect(await readFile(join(dir, entries[0] ?? ''), 'utf8')).toBe('{ not json');
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm --filter @recompose/desktop run test`
Expected: `FAIL`, since the test can't resolve `./json-file` (browser project and existing unit specs stay green).

- [ ] **Step 4: Implement the json shell**

Create `apps/desktop/src/main/storage/json-file.ts`:

```ts
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, filePath);
}

export async function quarantineFile(
  filePath: string,
  onCorrupt: (quarantinedPath: string) => void,
): Promise<void> {
  const quarantinedPath = `${filePath}.corrupt-${new Date().toISOString().replaceAll(':', '-')}`;
  await rename(filePath, quarantinedPath);
  onCorrupt(quarantinedPath);
}

export async function readJsonWithQuarantine(
  filePath: string,
  onCorrupt: (quarantinedPath: string) => void,
): Promise<unknown | undefined> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    await quarantineFile(filePath, onCorrupt);
    return undefined;
  }
}
```

Run: `pnpm --filter @recompose/desktop run test`
Expected: json-file specs `PASS`.

- [ ] **Step 5: Write the failing store specs**

Create `apps/desktop/src/main/storage/gateway-store.test.ts`:

```ts
import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { GATEWAY_CONFIG_VERSION, type GatewayConfig } from '@recompose/contracts';
import { describe, expect, test } from 'vitest';

import { listGatewayConfigs, saveGatewayConfig } from './gateway-store';

const config: GatewayConfig = {
  schemaVersion: GATEWAY_CONFIG_VERSION,
  slug: 'personal',
  displayName: 'Personal',
  virtualModels: [
    {
      id: 'vm1',
      slug: 'fast',
      displayName: 'fast',
      routing: {
        kind: 'target',
        id: 't1',
        accountId: 'acc1',
        providerModel: 'claude-sonnet-5',
        weight: 100,
      },
    },
  ],
  layout: { nodes: {} },
};

async function freshDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'recompose-gateways-'));
}

describe('gateway store', () => {
  test('a saved gateway lists back identically, filed under its slug', async () => {
    const dir = await freshDir();

    await saveGatewayConfig(dir, config);

    expect(await readdir(dir)).toEqual(['personal.json']);
    expect(await listGatewayConfigs(dir, () => undefined)).toEqual([config]);
  });

  test('an empty directory lists no gateways', async () => {
    expect(await listGatewayConfigs(await freshDir(), () => undefined)).toEqual([]);
  });

  test('a corrupt gateway file is quarantined and the rest still load', async () => {
    const dir = await freshDir();
    await saveGatewayConfig(dir, config);
    await writeFile(join(dir, 'broken.json'), 'not json', 'utf8');
    const seen: string[] = [];

    const loaded = await listGatewayConfigs(dir, (p) => seen.push(p));

    expect(loaded).toEqual([config]);
    expect(seen).toHaveLength(1);
  });

  test('a schema-invalid gateway file is quarantined too', async () => {
    const dir = await freshDir();
    await writeFile(
      join(dir, 'bad.json'),
      JSON.stringify({ schemaVersion: 1, slug: 'X!' }),
      'utf8',
    );
    const seen: string[] = [];

    const loaded = await listGatewayConfigs(dir, (p) => seen.push(p));

    expect(loaded).toEqual([]);
    expect(seen).toHaveLength(1);
  });
});
```

Create `apps/desktop/src/main/storage/settings-store.test.ts`:

```ts
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { defaultSettings } from '@recompose/contracts';
import { describe, expect, test } from 'vitest';

import { loadSettingsFile, saveSettingsFile } from './settings-store';

describe('settings store', () => {
  test('absent file yields defaults', async () => {
    const file = join(await mkdtemp(join(tmpdir(), 'recompose-settings-')), 'settings.json');

    expect(await loadSettingsFile(file, () => undefined)).toEqual(defaultSettings());
  });

  test('saved settings load back identically', async () => {
    const file = join(await mkdtemp(join(tmpdir(), 'recompose-settings-')), 'settings.json');
    const custom = { ...defaultSettings(), theme: 'dark' as const, enginePort: 9001 };

    await saveSettingsFile(file, custom);

    expect(await loadSettingsFile(file, () => undefined)).toEqual(custom);
  });
});
```

Create `apps/desktop/src/main/storage/accounts-store.test.ts`:

```ts
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { defaultAccountsDocument } from '@recompose/contracts';
import { describe, expect, test } from 'vitest';

import { loadAccountsFile, saveAccountsFile } from './accounts-store';

describe('accounts store', () => {
  test('absent file yields the empty registry', async () => {
    const file = join(await mkdtemp(join(tmpdir(), 'recompose-accounts-')), 'accounts.json');

    expect(await loadAccountsFile(file, () => undefined)).toEqual(defaultAccountsDocument());
  });

  test('a saved registry loads back identically', async () => {
    const file = join(await mkdtemp(join(tmpdir(), 'recompose-accounts-')), 'accounts.json');
    const doc = {
      schemaVersion: 1,
      accounts: [
        {
          id: 'a1',
          provider: 'anthropic',
          kind: 'subscription' as const,
          label: 'Max',
          credentialRef: 'c1',
        },
      ],
    };

    await saveAccountsFile(file, doc);

    expect(await loadAccountsFile(file, () => undefined)).toEqual(doc);
  });
});
```

Create `apps/desktop/src/main/storage/initialize-storage.test.ts`:

```ts
import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { defaultAccountsDocument, defaultSettings } from '@recompose/contracts';
import { describe, expect, test } from 'vitest';

import { initializeStorage } from './initialize-storage';

describe('storage boot', () => {
  test('first launch creates the layout and yields defaults', async () => {
    const userData = await mkdtemp(join(tmpdir(), 'recompose-userdata-'));

    const state = await initializeStorage(userData, () => undefined);

    expect(state).toEqual({
      settings: defaultSettings(),
      accounts: defaultAccountsDocument(),
      gateways: [],
    });
    expect(await readdir(userData)).toContain('gateways');
  });
});
```

- [ ] **Step 6: Run to verify failure**

Run: `pnpm --filter @recompose/desktop run test`
Expected: `FAIL`, since the four store modules don't exist.

- [ ] **Step 7: Implement the stores**

Create `apps/desktop/src/main/storage/gateway-store.ts`:

```ts
import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { loadGatewayConfig, type GatewayConfig } from '@recompose/contracts';

import { quarantineFile, readJsonWithQuarantine, writeJsonAtomic } from './json-file';

export async function saveGatewayConfig(dir: string, config: GatewayConfig): Promise<void> {
  await writeJsonAtomic(join(dir, `${config.slug}.json`), config);
}

export async function listGatewayConfigs(
  dir: string,
  onCorrupt: (quarantinedPath: string) => void,
): Promise<GatewayConfig[]> {
  await mkdir(dir, { recursive: true });
  const entries = await readdir(dir);
  const configs: GatewayConfig[] = [];
  for (const entry of entries.filter((name) => name.endsWith('.json')).sort()) {
    const filePath = join(dir, entry);
    const raw = await readJsonWithQuarantine(filePath, onCorrupt);
    if (raw === undefined) {
      continue;
    }
    try {
      configs.push(loadGatewayConfig(raw));
    } catch {
      await quarantineFile(filePath, onCorrupt);
    }
  }
  return configs;
}
```

Create `apps/desktop/src/main/storage/settings-store.ts`:

```ts
import { defaultSettings, loadSettings, type Settings } from '@recompose/contracts';

import { readJsonWithQuarantine, writeJsonAtomic } from './json-file';

export async function loadSettingsFile(
  filePath: string,
  onCorrupt: (quarantinedPath: string) => void,
): Promise<Settings> {
  const raw = await readJsonWithQuarantine(filePath, onCorrupt);
  if (raw === undefined) {
    return defaultSettings();
  }
  return loadSettings(raw);
}

export async function saveSettingsFile(filePath: string, settings: Settings): Promise<void> {
  await writeJsonAtomic(filePath, settings);
}
```

Create `apps/desktop/src/main/storage/accounts-store.ts`:

```ts
import {
  defaultAccountsDocument,
  loadAccountsDocument,
  type AccountsDocument,
} from '@recompose/contracts';

import { readJsonWithQuarantine, writeJsonAtomic } from './json-file';

export async function loadAccountsFile(
  filePath: string,
  onCorrupt: (quarantinedPath: string) => void,
): Promise<AccountsDocument> {
  const raw = await readJsonWithQuarantine(filePath, onCorrupt);
  if (raw === undefined) {
    return defaultAccountsDocument();
  }
  return loadAccountsDocument(raw);
}

export async function saveAccountsFile(
  filePath: string,
  accounts: AccountsDocument,
): Promise<void> {
  await writeJsonAtomic(filePath, accounts);
}
```

Create `apps/desktop/src/main/storage/initialize-storage.ts`:

```ts
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import type { AccountsDocument, GatewayConfig, Settings } from '@recompose/contracts';

import { loadAccountsFile } from './accounts-store';
import { listGatewayConfigs } from './gateway-store';
import { loadSettingsFile } from './settings-store';

export type StorageState = {
  settings: Settings;
  accounts: AccountsDocument;
  gateways: GatewayConfig[];
};

export async function initializeStorage(
  userDataPath: string,
  onCorrupt: (quarantinedPath: string) => void,
): Promise<StorageState> {
  const gatewaysDir = join(userDataPath, 'gateways');
  await mkdir(gatewaysDir, { recursive: true });
  return {
    settings: await loadSettingsFile(join(userDataPath, 'settings.json'), onCorrupt),
    accounts: await loadAccountsFile(join(userDataPath, 'accounts.json'), onCorrupt),
    gateways: await listGatewayConfigs(gatewaysDir, onCorrupt),
  };
}
```

- [ ] **Step 8: Run to verify pass**

Run: `pnpm --filter @recompose/desktop run test`
Expected: `PASS`. All storage specs stay green, and coverage includes the new modules at high percentages. The quarantine spec exercises the dynamic `rename` import in gateway-store's schema-invalid path.

- [ ] **Step 9: Wire the boot call**

In `apps/desktop/src/main/index.ts`, add the import (after the existing imports):

```ts
import { initializeStorage } from './storage/initialize-storage';
```

and inside the existing `app.whenReady().then(() => { ... })` callback, as its first statement:

```ts
void initializeStorage(app.getPath('userData'), (quarantinedPath) => {
  console.warn(`storage document quarantined: ${quarantinedPath}`);
});
```

- [ ] **Step 10: Full gates, then commit**

Run: `pnpm --filter @recompose/desktop run typecheck && pnpm --filter @recompose/desktop run build && pnpm test && pnpm run lint:boundaries && pnpm run lint:fsd && pnpm run lint:dead`
Expected: all green (build proves electron-vite bundles the workspace TS source).

```bash
git add apps/desktop pnpm-lock.yaml
git commit -m "feat(desktop): storage services with atomic writes and quarantine"
```

---

### Task 5: Vault (safeStorage codec + secret map)

**Files:**

- Create: `apps/desktop/src/main/storage/vault.ts`
- Create: `apps/desktop/src/main/storage/safe-storage-codec.ts`
- Test: `apps/desktop/src/main/storage/vault.test.ts`
- Test: `apps/desktop/src/main/storage/safe-storage-codec.test.ts`

**Interfaces:**

- Consumes: `writeJsonAtomic`, `readJsonWithQuarantine` (Task 4).
- Produces: `type SecretCodec = { encrypt: (plain: string) => string; decrypt: (encryptedBase64: string) => string; isPlaintextFallback: boolean }`; `createSafeStorageCodec(): SecretCodec` (the only electron-importing storage file); vault functions `loadVaultFile(filePath, onCorrupt): Promise<VaultDocument>`, `saveVaultFile(filePath, vault): Promise<void>`, `setSecret(vault, codec, ref, plain): VaultDocument`, `getSecret(vault, codec, ref): string | undefined`, `deleteSecret(vault, ref): VaultDocument` with `type VaultDocument = { schemaVersion: 1; entries: Record<string, string> }`.

- [ ] **Step 1: Write the failing vault specs**

Create `apps/desktop/src/main/storage/vault.test.ts`:

```ts
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import type { SecretCodec } from './safe-storage-codec';
import { deleteSecret, getSecret, loadVaultFile, saveVaultFile, setSecret } from './vault';

const reverseCodec: SecretCodec = {
  encrypt: (plain) => Buffer.from([...plain].reverse().join('')).toString('base64'),
  decrypt: (encrypted) => [...Buffer.from(encrypted, 'base64').toString('utf8')].reverse().join(''),
  isPlaintextFallback: false,
};

describe('secret vault', () => {
  test('a stored secret round-trips through the codec', () => {
    const vault = setSecret({ schemaVersion: 1, entries: {} }, reverseCodec, 'cred-1', 'sk-abc');

    expect(getSecret(vault, reverseCodec, 'cred-1')).toBe('sk-abc');
  });

  test('the plaintext never appears in the persisted file', async () => {
    const file = join(await mkdtemp(join(tmpdir(), 'recompose-vault-')), 'vault.bin');
    const vault = setSecret(
      { schemaVersion: 1, entries: {} },
      reverseCodec,
      'cred-1',
      'sk-topsecret',
    );

    await saveVaultFile(file, vault);

    expect(await readFile(file, 'utf8')).not.toContain('sk-topsecret');
  });

  test('an absent vault file loads as the empty vault', async () => {
    const file = join(await mkdtemp(join(tmpdir(), 'recompose-vault-')), 'vault.bin');

    expect(await loadVaultFile(file, () => undefined)).toEqual({ schemaVersion: 1, entries: {} });
  });

  test('a saved vault loads back and still decrypts', async () => {
    const file = join(await mkdtemp(join(tmpdir(), 'recompose-vault-')), 'vault.bin');
    await saveVaultFile(
      file,
      setSecret({ schemaVersion: 1, entries: {} }, reverseCodec, 'r', 'value'),
    );

    const loaded = await loadVaultFile(file, () => undefined);

    expect(getSecret(loaded, reverseCodec, 'r')).toBe('value');
  });

  test('deleting a secret removes only that entry', () => {
    let vault = setSecret({ schemaVersion: 1, entries: {} }, reverseCodec, 'a', '1');
    vault = setSecret(vault, reverseCodec, 'b', '2');

    const after = deleteSecret(vault, 'a');

    expect(getSecret(after, reverseCodec, 'a')).toBeUndefined();
    expect(getSecret(after, reverseCodec, 'b')).toBe('2');
  });
});
```

Create `apps/desktop/src/main/storage/safe-storage-codec.test.ts`:

```ts
import { describe, expect, test, vi } from 'vitest';

const encryptString = vi.fn((plain: string) => Buffer.from(`enc:${plain}`, 'utf8'));
const decryptString = vi.fn((buffer: Buffer) => buffer.toString('utf8').replace(/^enc:/, ''));
const isEncryptionAvailable = vi.fn(() => true);
const getSelectedStorageBackend = vi.fn(() => 'keychain');

vi.mock('electron', () => ({
  safeStorage: { encryptString, decryptString, isEncryptionAvailable, getSelectedStorageBackend },
}));

describe('safeStorage codec', () => {
  test('encrypt and decrypt delegate to the OS codec through base64', async () => {
    const { createSafeStorageCodec } = await import('./safe-storage-codec');
    const codec = createSafeStorageCodec();

    const encrypted = codec.encrypt('sk-abc');

    expect(encrypted).not.toContain('sk-abc');
    expect(codec.decrypt(encrypted)).toBe('sk-abc');
  });

  test('the plaintext-fallback backend is surfaced, not hidden', async () => {
    getSelectedStorageBackend.mockReturnValueOnce('basic_text');
    vi.resetModules();
    const { createSafeStorageCodec } = await import('./safe-storage-codec');

    expect(createSafeStorageCodec().isPlaintextFallback).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @recompose/desktop run test`
Expected: `FAIL`, since the two modules don't exist.

- [ ] **Step 3: Implement**

Create `apps/desktop/src/main/storage/safe-storage-codec.ts`:

```ts
import { safeStorage } from 'electron';

export type SecretCodec = {
  encrypt: (plain: string) => string;
  decrypt: (encryptedBase64: string) => string;
  isPlaintextFallback: boolean;
};

export function createSafeStorageCodec(): SecretCodec {
  return {
    encrypt: (plain) => safeStorage.encryptString(plain).toString('base64'),
    decrypt: (encryptedBase64) => safeStorage.decryptString(Buffer.from(encryptedBase64, 'base64')),
    isPlaintextFallback:
      process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text',
  };
}
```

Note: `getSelectedStorageBackend` exists only on Linux in Electron's typings. If the typecheck rejects the direct call, gate it exactly as above (`process.platform === 'linux'`), and consult the installed `electron` typings for the current guard shape. Never cast to `any`.

Create `apps/desktop/src/main/storage/vault.ts`:

```ts
import type { SecretCodec } from './safe-storage-codec';

import { readJsonWithQuarantine, writeJsonAtomic } from './json-file';

export type VaultDocument = {
  schemaVersion: 1;
  entries: Record<string, string>;
};

const emptyVault: VaultDocument = { schemaVersion: 1, entries: {} };

function isVaultDocument(value: unknown): value is VaultDocument {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate['schemaVersion'] === 1 &&
    typeof candidate['entries'] === 'object' &&
    candidate['entries'] !== null &&
    Object.values(candidate['entries']).every((entry) => typeof entry === 'string')
  );
}

export async function loadVaultFile(
  filePath: string,
  onCorrupt: (quarantinedPath: string) => void,
): Promise<VaultDocument> {
  const raw = await readJsonWithQuarantine(filePath, onCorrupt);
  if (raw === undefined) {
    return emptyVault;
  }
  if (!isVaultDocument(raw)) {
    return emptyVault;
  }
  return raw;
}

export async function saveVaultFile(filePath: string, vault: VaultDocument): Promise<void> {
  await writeJsonAtomic(filePath, vault);
}

export function setSecret(
  vault: VaultDocument,
  codec: SecretCodec,
  ref: string,
  plain: string,
): VaultDocument {
  return { ...vault, entries: { ...vault.entries, [ref]: codec.encrypt(plain) } };
}

export function getSecret(
  vault: VaultDocument,
  codec: SecretCodec,
  ref: string,
): string | undefined {
  const encrypted = vault.entries[ref];
  if (encrypted === undefined) {
    return undefined;
  }
  return codec.decrypt(encrypted);
}

export function deleteSecret(vault: VaultDocument, ref: string): VaultDocument {
  const { [ref]: removed, ...rest } = vault.entries;
  void removed;
  return { ...vault, entries: rest };
}
```

- [ ] **Step 4: Run to verify pass, full gates, commit**

Run: `pnpm --filter @recompose/desktop run test && pnpm --filter @recompose/desktop run typecheck && pnpm run lint:dead`
Expected: all green. Test files consuming the vault exports satisfy knip, and the electron mock is a sanctioned process-boundary double.

```bash
git add apps/desktop
git commit -m "feat(desktop): secret vault over safeStorage codec"
```

---

### Task 6: Architecture decision record 0016

**Files:**

- Create: `docs/adr/0016-storage-architecture.md`
- Modify: `docs/adr/README.md` (index row after 0015)

**Interfaces:**

- Consumes: shipped code from Tasks 1–5 (referenced, not changed).
- Produces: ADR-0016, with nothing downstream.

- [ ] **Step 1: Write the ADR**

Create `docs/adr/0016-storage-architecture.md`:

```markdown
# ADR-0016: Storage — JSON Configs, safeStorage Vault, node:sqlite Usage Log

**Status**: Accepted
**Date**: 2026-07-23

## Context

Four kinds of data need local, offline persistence with different characters: gateway configs (the canvas graph, also the product's shareable artifact), provider secrets, app settings, and the usage log behind the Usage drawer. The engine reads configs and secrets but runs with zero `electron` imports and outlives the app window; a future headless CLI must reuse the same storage.

## Decision

- **Per-character formats** (user-locked): gateway configs as one JSON file per gateway (`userData/gateways/<slug>.json`, human-readable, git-able, the same truth as the canvas "Edit-as-JSON" view); a cross-gateway `accounts.json` registry referenced by `accountId`; app settings as one small JSON (no settings library — electron-store is unmaintained); secrets in a safeStorage-encrypted `vault.bin` keyed by `credentialRef`; usage logs in an engine-owned `node:sqlite` database (zero native deps, same code headless; `better-sqlite3` is the recorded fallback if Electron's Node disagrees).
- **Single-writer per file**: main owns configs/accounts/settings/vault; the engine owns `usage.db`. Config changes reach the engine by message, never by file watching — one source of truth, no read/write races. Main writes atomically (tmp + rename).
- **Secrets flow, never rest, outside the vault**: only main decrypts; decrypted values pass to the engine in memory at spawn and on change; the engine never writes a secret to disk; the detached engine keeps serving after app quit with what it holds and is respawned only by the app. Configs structurally cannot carry secrets (strict schemas reject unknown keys).
- **schemaVersion + stepwise migrations everywhere**, shared through `@recompose/contracts` — opened by this decision as the first real package (`zod` schemas, pure migration chain, fast-check round-trip properties). Unreadable or invalid documents are quarantined aside as `<name>.corrupt-<timestamp>` and reported — never silently repaired or deleted.
- On Linux, `safeStorage`'s `basic_text` fallback is surfaced to the user as a visible warning, not hidden.

## Alternatives

- **Single SQLite for everything**: transactional and tidy, but turns the shareable config into an opaque blob and adds an export step between the user and their own data.
- **OS keychain library (direct)**: would let headless read secrets without Electron, at the cost of a native dependency and per-process keychain prompts; deferred to the headless ADR.
- **electron-store**: unmaintained; a zod-validated file is smaller and typed end-to-end.

## Consequences

**Good**: configs are portable and diffable; every document is versioned from day one; the secret boundary is structural (schemas reject unknown keys, vault file never sees plaintext, engine never persists secrets); contracts opened with pure, property-tested logic shared by all three consumers.

**Bad**: engine-side pieces (usage recorder, config/secret message handoff) wait for `packages/engine`; a detached engine cannot be respawned without the app; JSON files are editable by hand outside the app — quarantine handles breakage, but hand edits between app sessions are a supported risk, not a prevented one.
```

- [ ] **Step 2: Add the index row**

In `docs/adr/README.md`, append after the 0015 row:

```markdown
| [0016](0016-storage-architecture.md) | Storage — JSON Configs, safeStorage Vault, node:sqlite Usage Log | Accepted | 2026-07-23 |
```

- [ ] **Step 3: Commit**

```bash
git add docs/adr
git commit -m "docs(adr): record storage architecture (ADR-0016)"
```

---

## Deviations discovered in execution

- **`@recompose/contracts` must be a `devDependency` of `@recompose/desktop`, not a `dependency`.** Task 4 Step 1 (`pnpm --filter @recompose/desktop add "@recompose/contracts@workspace:*"`) lands it in `dependencies`, which electron-vite externalizes for the main bundle. The built `out/main/index.js` then does `require("@recompose/contracts")`, unresolvable under Electron's Node at runtime, so the app can't boot. Contracts is TS-source-only and consumed entirely at build time, so it belongs in `devDependencies`, letting electron-vite inline it (zod included) instead of externalizing it.
- **Settings, accounts, and gateway configs now share one quarantine path.** The plan's Task 4 snippets have `loadSettingsFile`/`loadAccountsFile` call `loadSettings`/`loadAccountsDocument` directly after `readJsonWithQuarantine`, so a syntactically valid but schema-invalid document throws instead of landing in quarantine. This is inconsistent with gateway-store's per-file handling and with the spec's `unreadable or invalid input is quarantined` rule. `json-file.ts` gained `readDocumentWithQuarantine<T>(filePath, parse, onCorrupt): Promise<T | undefined>`, which quarantines on both JSON syntax errors and schema-validation failures, and `settings-store.ts`, `accounts-store.ts`, and `gateway-store.ts` are all rewired through it.
- **Vault documents that fail structural validation are now quarantined, not emptied without warning, except a newer `schemaVersion`, which throws.** The plan's `loadVaultFile` returns `emptyVault` for any document that fails `isVaultDocument`, including a syntactically fine file with a bad shape, and the next save would overwrite it with an empty vault without warning, losing secrets. `vault.ts` now quarantines the file (matching the other stores) when the document is structurally invalid and `schemaVersion` is absent or `1`. When `schemaVersion` is an integer greater than `1`, it throws instead, naming both versions, so an app downgrade can't wipe a newer vault without warning.
