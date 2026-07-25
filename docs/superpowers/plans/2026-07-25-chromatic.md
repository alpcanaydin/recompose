# Chromatic Visual Regression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing Storybook into Chromatic for blocking visual regression baselines, and collapse the three hand-rolled fake bridges into one authoritative module.

**Architecture:** A dedicated `chromatic.yml` workflow on the `push` trigger publishes Storybook to Chromatic via the SHA-pinned official action; the gate is Chromatic's own "UI Tests" commit status made required in the ruleset (codecov/patch precedent), not a failing CI job. The fake bridge extracts from `.storybook/recompose-bridge.tsx` into `shared/testing/`, consumed by the decorator and both browser tests.

**Tech Stack:** chromaui/action v18.1.0, chromatic CLI 18.1.0 (exact-pinned devDep), Storybook 10.5.4, Vitest browser mode, GitHub rulesets API.

**Spec:** `docs/superpowers/specs/2026-07-25-chromatic-design.md`

## Global Constraints

- Never commit to `main`; all work happens on branch `worktree-chromatic` in this worktree; one PR closes the job.
- The forbidden owner alias (the word the gitleaks `forbidden-owner-alias` rule bans) must never appear in any artifact.
- No code comments. No em dashes in authored prose. devDependencies pin exact.
- Every commit message follows caveman-commit (Conventional Commits, terse, imperative) and ends with the trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- The PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- Test assertions in the two browser tests must not change; only their setup plumbing changes (spec: "Test assertions stay untouched").
- `exitZeroOnChanges: true` and `autoAcceptChanges: main` exactly as spec'd; no TurboSnap (`onlyChanged` must NOT appear).
- Workflow actions pinned by full commit SHA with a trailing version comment, matching `ci.yml` style.
- ADRs and docs pass Vale (Microsoft, error strength) and cspell; plans (this file) are exempt.
- Maintainer prerequisites (Chromatic project + `CHROMATIC_PROJECT_TOKEN` secret, GitHub App installed, PR-comment toggle on) are assumed done before Task 4 runs.

## File structure

| File                                                                               | Responsibility                                                        |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `apps/desktop/src/renderer/src/shared/testing/fake-bridge.ts`                      | The one authoritative fake `window.recompose` bridge (pure, no React) |
| `apps/desktop/src/renderer/src/shared/testing/index.ts`                            | Public API of the `testing` segment (FSD rule 4-2)                    |
| `apps/desktop/.storybook/recompose-bridge.tsx`                                     | Slims to the React/QueryClient decorator wrapper                      |
| `apps/desktop/src/renderer/src/app/router.browser.test.tsx`                        | Drops its local `installFakeBridge`, consumes the shared one          |
| `apps/desktop/src/renderer/src/pages/providers/ui/providers-page.browser.test.tsx` | Drops its local `bridgeWith`, consumes the shared one                 |
| `.github/workflows/chromatic.yml`                                                  | New workflow: publish Storybook to Chromatic on every push            |
| `apps/desktop/package.json` + `pnpm-lock.yaml`                                     | `chromatic@18.1.0` exact devDep                                       |
| `docs/adr/0032-chromatic-visual-regression.md` + `docs/adr/README.md`              | Decision record + index row                                           |

**Parallelizable:** Tasks 1, 2, 3 touch disjoint files and can run as parallel subagent dispatches. Task 4 requires 1–3 complete and pushed.

---

### Task 1: Extract the fake bridge into `shared/testing`

This is a pure refactor: the suite is the harness, and it must be green before and after with identical assertions.

**Files:**

- Create: `apps/desktop/src/renderer/src/shared/testing/fake-bridge.ts`
- Create: `apps/desktop/src/renderer/src/shared/testing/index.ts`
- Modify: `apps/desktop/.storybook/recompose-bridge.tsx` (full rewrite, keeps filename and export name)
- Modify: `apps/desktop/src/renderer/src/app/router.browser.test.tsx`
- Modify: `apps/desktop/src/renderer/src/pages/providers/ui/providers-page.browser.test.tsx`

**Interfaces:**

- Produces: `installFakeBridge(parameters?: BridgeParameters): void` and `type BridgeParameters = { accounts?: AccountsDocument; overrides?: Partial<RecomposeIpc> }`, exported from `shared/testing` (`index.ts` re-export). No later task consumes these; the decorator and tests are rewired inside this task.

- [ ] **Step 1: Prove the suite is green before touching anything**

Run: `pnpm --filter @recompose/desktop test`
Expected: PASS (all projects: unit, browser, storybook).

- [ ] **Step 2: Create the shared fake-bridge module**

`apps/desktop/src/renderer/src/shared/testing/fake-bridge.ts` — this is the current decorator's `installBridge` verbatim, with an exported name and a defaulted parameter:

```ts
import type { AccountsDocument, RecomposeIpc } from '@recompose/contracts';

const emptyDocument: AccountsDocument = { schemaVersion: 1, accounts: [] };

export type BridgeParameters = {
  accounts?: AccountsDocument;
  overrides?: Partial<RecomposeIpc>;
};

export function installFakeBridge(parameters: BridgeParameters = {}): void {
  let registry = parameters.accounts ?? emptyDocument;
  let nextAccountNumber = registry.accounts.length + 1;

  window.recompose = {
    'gateways:list': async () => Promise.resolve({ ok: true, value: [] }),
    'gateways:save': async () => Promise.resolve({ ok: true, value: [] }),
    'settings:get': async () =>
      Promise.resolve({
        ok: true,
        value: { schemaVersion: 1, theme: 'system', enginePort: 8397 },
      }),
    'settings:save': async (settings) => Promise.resolve({ ok: true, value: settings }),
    'accounts:list': async () => Promise.resolve({ ok: true, value: registry }),
    'accounts:connect': async (request) => {
      const id = `a${nextAccountNumber}`;

      nextAccountNumber += 1;

      registry = {
        ...registry,
        accounts: [
          ...registry.accounts,
          {
            id,
            provider: request.provider,
            kind: request.kind,
            label: request.label,
            credentialRef: `c-${id}`,
          },
        ],
      };

      return Promise.resolve({ ok: true, value: registry });
    },
    'accounts:remove': async (request) => {
      registry = {
        ...registry,
        accounts: registry.accounts.filter((row) => row.id !== request.id),
      };

      return Promise.resolve({ ok: true, value: registry });
    },
    ...parameters.overrides,
  };
}
```

`apps/desktop/src/renderer/src/shared/testing/index.ts`:

```ts
export { installFakeBridge } from './fake-bridge';
export type { BridgeParameters } from './fake-bridge';
```

- [ ] **Step 3: Slim the decorator to its React wrapper**

Replace the entire contents of `apps/desktop/.storybook/recompose-bridge.tsx` with:

```tsx
import type { Decorator } from '@storybook/react-vite';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useMemo } from 'react';

import type { BridgeParameters } from '../src/renderer/src/shared/testing';

import { installFakeBridge } from '../src/renderer/src/shared/testing';

export const withRecomposeBridge: Decorator = (Story, context) => {
  const bridgeParameter = context.parameters['bridge'] as BridgeParameters | undefined;

  const queryClient = useMemo(() => {
    installFakeBridge(bridgeParameter ?? {});

    return new QueryClient({ defaultOptions: { queries: { retry: false } } });
  }, [bridgeParameter]);

  return (
    <Suspense fallback={null}>
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    </Suspense>
  );
};
```

The `as BridgeParameters | undefined` cast is the ADR-0029-sanctioned bridge cast; keep it. `preview.ts` keeps importing `withRecomposeBridge` from `./recompose-bridge` unchanged. If prettier or the oxlint import-order rule reorders the import groups on format, accept its output.

- [ ] **Step 4: Rewire the router browser test**

In `apps/desktop/src/renderer/src/app/router.browser.test.tsx`:

1. Delete the local `emptyAccounts` function, the local `installFakeBridge` function, and the now-unused `RecomposeIpc` type import if present. Keep `seededAccounts`.
2. Add the import (relative path from `app/`): `import { installFakeBridge } from '../shared/testing';`
3. Change `renderAt` to:

```tsx
async function renderAt(path: string, initial?: AccountsDocument) {
  installFakeBridge(initial === undefined ? {} : { accounts: initial });

  const queryClient = createQueryClient();
  const router = createAppRouter({
    queryClient,
    history: createMemoryHistory({ initialEntries: [path] }),
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
```

The `initial === undefined ? {} : { accounts: initial }` shape exists because `exactOptionalPropertyTypes` forbids passing an explicit `undefined` into the optional `accounts` property.

4. In the loader-warming test, change the direct call `installFakeBridge(seeded)` to `installFakeBridge({ accounts: seeded })`.
5. Touch nothing else: every `expect`/assertion line stays byte-identical. Call sites `renderAt('/')`, `renderAt('/no-such-page')`, `renderAt('/gateways/my-gateway')`, `renderAt('/gateways/Not%20A%20Slug')`, and `renderAt('/providers', seededAccounts())` all keep working unchanged.

- [ ] **Step 5: Rewire the providers page browser test**

In `apps/desktop/src/renderer/src/pages/providers/ui/providers-page.browser.test.tsx`:

1. Delete the local `bridgeWith` function. Keep the `seeded` document constant.
2. Add the import (relative path from `pages/providers/ui/`): `import { installFakeBridge } from '../../../shared/testing';`
3. Keep the `RecomposeIpc` type import only if still referenced; after this rewiring it is not, so remove it (the orphan rule: your change made it unused).
4. Replace every call:
   - `bridgeWith()` → `installFakeBridge({ accounts: seeded })` (five sites)
   - `bridgeWith({ 'accounts:remove': ... })` → `installFakeBridge({ accounts: seeded, overrides: { 'accounts:remove': ... } })`
   - `bridgeWith({ 'accounts:connect': ... })` → `installFakeBridge({ accounts: seeded, overrides: { 'accounts:connect': ... } })`
5. Assertions stay byte-identical. Note the generated ids shift from `a2`/`c2` to `a2`/`c-a2`: no assertion reads ids or credentialRefs (verified), so behavior observed by the tests is unchanged.

- [ ] **Step 6: Run the full suite and the structure gates**

Run: `pnpm --filter @recompose/desktop test`
Expected: PASS, same test count as Step 1.

Run: `pnpm run lint:fsd && pnpm run lint:boundaries && pnpm run lint:dead && pnpm run lint:dup && pnpm exec turbo run lint typecheck`
Expected: all PASS (steiger accepts the `shared/testing` segment; verified empirically before planning).

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/renderer/src/shared/testing apps/desktop/.storybook/recompose-bridge.tsx apps/desktop/src/renderer/src/app/router.browser.test.tsx apps/desktop/src/renderer/src/pages/providers/ui/providers-page.browser.test.tsx
git commit -m "refactor(desktop): one fake bridge for stories and browser tests

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Lefthook runs the full gate suite on commit; it must pass.

---

### Task 2: Chromatic workflow and pinned CLI

**Files:**

- Create: `.github/workflows/chromatic.yml`
- Modify: `apps/desktop/package.json` (devDependencies) + `pnpm-lock.yaml`

**Interfaces:**

- Consumes: repository secret `CHROMATIC_PROJECT_TOKEN` (maintainer prerequisite).
- Produces: a workflow whose Chromatic build posts the "UI Tests" commit status Task 4 promotes to required.

- [ ] **Step 1: Add the exact-pinned CLI**

Run: `pnpm add -D -E chromatic@18.1.0 --filter @recompose/desktop`
Expected: `apps/desktop/package.json` gains `"chromatic": "18.1.0"`; lockfile updates; postinstall (electron-builder native rebuild) succeeds.

- [ ] **Step 2: Create the workflow**

`.github/workflows/chromatic.yml` (SHA pins copied from `ci.yml`; chromaui/action pin resolved from the v18.1.0 tag):

```yaml
name: chromatic

on:
  push:

permissions:
  contents: read

concurrency:
  group: chromatic-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}

jobs:
  chromatic:
    runs-on: ubuntu-latest
    steps:
      - uses: step-security/harden-runner@bf7454d06d71f1098171f2acdf0cd4708d7b5920 # v2.20.0
        with:
          egress-policy: audit
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
        with:
          fetch-depth: 0
          persist-credentials: false
      - uses: pnpm/action-setup@0ebf47130e4866e96fce0953f49152a61190b271 # v6
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile --trust-lockfile
      - uses: chromaui/action@14cfaef73576e69f95f47f60058063f46ca38719 # v18.1.0
        with:
          projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
          workingDir: apps/desktop
          buildScriptName: storybook:build
          exitZeroOnChanges: true
          autoAcceptChanges: main
```

Notes locked by the spec: no path filter (every head commit must report a status), `fetch-depth: 0` (baseline ancestry), no `onlyChanged`. `@recompose/contracts` exports its TypeScript source directly, so no package build precedes `storybook:build`.

- [ ] **Step 3: Verify the Storybook build the action will run**

Run: `pnpm --filter @recompose/desktop run storybook:build`
Expected: builds to `apps/desktop/storybook-static` without errors. (actionlint and zizmor have no local runners in this repo; the required CI jobs lint the workflow on the PR.)

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/chromatic.yml apps/desktop/package.json pnpm-lock.yaml
git commit -m "ci: chromatic visual regression workflow

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: ADR-0032 and the index row

**Files:**

- Create: `docs/adr/0032-chromatic-visual-regression.md`
- Modify: `docs/adr/README.md` (append one table row)

**Interfaces:**

- Consumes: decisions and rationale from `docs/superpowers/specs/2026-07-25-chromatic-design.md`.
- Produces: the ADR the meta-gate requires for a workflow-file change.

- [ ] **Step 1: Write the decision record**

`docs/adr/0032-chromatic-visual-regression.md`, exactly:

```markdown
# 0032: Chromatic visual regression, the UI Tests gate, and the fake-bridge extraction

**Status**: Accepted
**Date**: 2026-07-25

## Context

The tenth infrastructure-queue item wires the Storybook workshop from ADR-0029 into visual regression testing. Six seed components and nine stories exist in `apps/desktop`, and a `storybook:build` smoke already runs inside the required `check` job. The free-tier policy from ADR-0022 allows Chromatic's free plan: 5,000 Chrome snapshots a month. Nine stories cost nine snapshots a build, which supports more than 500 builds a month. The repository merges through squash, which rewrites commits and orphans accepted baselines unless the workflow applies the documented countermeasure. One rider from the Storybook ledger landed here: the fake bridge existed three times, once in the Storybook decorator and once in each of two Vitest browser tests.

## Decision

- **A dedicated `chromatic.yml` workflow runs on the `push` trigger.** Chromatic's guidance rejects `pull_request` triggers because GitHub builds an ephemeral merge commit there, and Chromatic can pick a wrong baseline from it. The workflow carries no path filter, so every head commit reports a status, and it checks out with `fetch-depth: 0` because baseline ancestry detection needs full git history.
- **The official `chromaui/action` runs the publish, pinned by commit SHA to v18.1.0.** `workingDir` points at `apps/desktop` and `buildScriptName` at `storybook:build`. The `chromatic` command-line interface also pins exact at 18.1.0 as a devDependency, so Renovate proposes coordinated bumps and local runs match the action.
- **Chromatic's UI Tests status check is the required gate, added to the ruleset.** Accepting a diff in Chromatic's web interface flips the check green without re-running any workflow. A failed-job gate would demand a manual re-run after every acceptance, so `exitZeroOnChanges: true` keeps the job green while diffs await review, and the job fails only on real errors such as a broken Storybook build. This deviates from the ADR-0007 convention that gates join the `ci-success` needs list: a `push`-triggered workflow lives outside the `ci` workflow and cannot join its needs. `codecov/patch` (integration 254) and CodeRabbit already gate through the ruleset the same way; UI Tests joins them with the Chromatic.com integration (47100).
- **`autoAcceptChanges: main` applies the squash-merge countermeasure.** After a merge, the first `main` build accepts itself as the new baseline, so the next pull request diffs against merged reality and nobody reviews the same change twice.
- **No TurboSnap.** It stays locked until ten continuous-integration builds complete, and at nine stories a full build costs nine snapshots. The revisit trigger is story growth that threatens the snapshot budget.
- **The Chromatic GitHub App posts the official pull-request comment.** The comment carries visual and accessibility change counts plus a link to the published Storybook, and it updates itself on every build. The UI Review feature stays off: the maintainer works solo, and the UI Tests accept flow already covers approval.
- **The fake bridge extracted into `shared/testing`.** The pure `installFakeBridge` function and its `BridgeParameters` type moved from `.storybook/recompose-bridge.tsx` into `apps/desktop/src/renderer/src/shared/testing/fake-bridge.ts`. Three consumers share it: the Storybook decorator keeps only its React and QueryClient wrapper, and both browser tests dropped their hand-rolled stubs. Assertions stayed byte-identical; only setup plumbing changed.
- **No lefthook leg.** Chromatic needs the network and a secret, so the standing pre-commit rule's "where applicable" clause exempts it. The `storybook:build` smoke stays in `check` as the network-free fast signal.

## Alternatives

- **A `chromatic` job inside `ci.yml` gated through `ci-success` needs**: rejected. The `pull_request` trigger risks wrong baselines, and a failed-job gate forces a manual re-run after every acceptance.
- **The `pull_request` trigger with head-ref checkout overrides**: rejected. The `push` trigger is the documented path and needs no override plumbing.
- **TurboSnap**: rejected for now. Locked until ten builds, incompatible with `pull_request` triggers, and worthless at nine stories.
- **The UI Review feature as a second required check**: rejected. A solo maintainer reviews once, in the UI Tests accept flow.
- **Keeping three fake bridges**: rejected. The stub encodes one piece of knowledge, the fake IPC contract behavior, and Don't Repeat Yourself applies to knowledge.

## Consequences

**Good**: every pull request gets a visual diff against the accepted baseline, blocked until a human accepts. The PR comment surfaces change counts and the published Storybook without leaving GitHub. Merged work never re-blocks, because `main` builds accept themselves. The fake bridge has one authoritative implementation.

**Bad, and accepted**: fork pull requests never fire the `push` workflow, so the required UI Tests check never reports and the merge blocks. Chromatic's sanctioned fix, a plaintext project token in the workflow, waits until an external contributor appears; the token only uploads builds and grants no account access. Every push costs nine snapshots against the 5,000 monthly budget; skip globs for bot branches or TurboSnap recover headroom if pressure appears. A required external check depends on Chromatic's availability: an outage blocks merges until it recovers or the maintainer bypasses with admin rights.
```

- [ ] **Step 2: Append the index row**

In `docs/adr/README.md`, after the 0031 row, add:

```markdown
| [0032](0032-chromatic-visual-regression.md) | Chromatic Visual Regression, the UI Tests Gate, and the Fake-Bridge Extraction | Accepted | 2026-07-25 |
```

Then run `pnpm run fmt` so prettier settles table alignment, and `pnpm run fmt:check` to confirm.

- [ ] **Step 3: Run the prose gates**

Run: `pnpm run lint:prose && pnpm run lint:spell`
Expected: 0 errors. (`Chromatic`, `TurboSnap`, and lowercase `visual` in headings are already covered: the spec commit added `[Vv]isual` to the Vale vocabulary and `chromaui` to cspell.)

- [ ] **Step 4: Commit**

```bash
git add docs/adr/0032-chromatic-visual-regression.md docs/adr/README.md
git commit -m "docs(adr): chromatic visual regression record

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: PR, first build, and the UI Tests ruleset gate

Runs after Tasks 1–3 are committed. Maintainer prerequisites must be done: `CHROMATIC_PROJECT_TOKEN` secret set, Chromatic GitHub App installed, PR-comment toggle on.

**Files:** none (GitHub operations only).

**Interfaces:**

- Consumes: the pushed branch with all three commits; the "UI Tests" status the first Chromatic build posts.

- [ ] **Step 1: Confirm the secret exists before pushing**

Run: `gh secret list --repo alpcanaydin/recompose | grep CHROMATIC_PROJECT_TOKEN`
Expected: one row. If absent, STOP and ask the maintainer to finish the prerequisites.

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin worktree-chromatic
gh pr create --title "ci: chromatic visual regression gate" --body "$(cat <<'EOF'
## Summary

- dedicated chromatic.yml on the push trigger publishes Storybook to Chromatic (SHA-pinned chromaui/action v18.1.0, chromatic CLI 18.1.0 exact devDep)
- gate = Chromatic's UI Tests status check, required via the ruleset (codecov/patch precedent); exitZeroOnChanges keeps the job green while diffs await review; autoAcceptChanges: main handles squash merges
- fake bridge extracted into shared/testing, consumed by the Storybook decorator and both browser tests (assertions untouched)
- ADR-0032 records the gate, the TurboSnap rejection, the fork residual, and the extraction

## Test plan

- [ ] full local gate suite green (lefthook)
- [ ] chromatic workflow runs on this branch and posts the UI Tests status
- [ ] UI Tests added to the ruleset as required and shows on this PR
- [ ] browser tests + stories pass unchanged after the extraction

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Watch the chromatic workflow to completion**

Run: `gh run list --branch worktree-chromatic --workflow chromatic --limit 1` then `gh run watch <id>` (or a Monitor loop).
Expected: conclusion success. The first build creates baselines (new stories auto-accept as new; the build passes).

- [ ] **Step 4: Verify the UI Tests status and capture its integration**

```bash
gh api repos/alpcanaydin/recompose/commits/$(git rev-parse HEAD)/status --jq '.statuses[] | {context, state}'
```

Expected: a `UI Tests` context (state `success` on a no-diff first build). If the context string differs, use the observed string in Step 5.

- [ ] **Step 5: Add UI Tests to the ruleset**

```bash
gh api repos/alpcanaydin/recompose/rulesets/19530816 > /tmp/ruleset-current.json
```

Edit the `required_status_checks` rule's `parameters.required_status_checks` array to append `{"context": "UI Tests", "integration_id": 47100}` (47100 = the Chromatic.com GitHub App id, verified via `gh api /apps/chromatic-com`), keeping the existing `ci-success`, `CodeRabbit`, and `codecov/patch` entries, then:

```bash
gh api -X PUT repos/alpcanaydin/recompose/rulesets/19530816 --input /tmp/ruleset-updated.json
```

The PUT body needs only `name`, `enforcement`, `target`, `conditions`, and `rules` from the current JSON with the one array edited. If the permission classifier denies the PUT, hand the exact command to the maintainer to run via the `!` prefix, or they add it in Settings → Rules: required status check "UI Tests" from the Chromatic.com app. Do not work around a denial.

- [ ] **Step 6: Verify the gate end-to-end on the PR**

Run: `gh pr view --json statusCheckRollup --jq '.statusCheckRollup[] | select(.context == "UI Tests" or .name == "UI Tests")'`
Expected: UI Tests listed among the PR's checks and required by the ruleset. Confirm the Chromatic PR comment appeared (PR-comment toggle prerequisite).

- [ ] **Step 7: CodeRabbit and merge flow**

Standard project flow: judge every CodeRabbit finding against docs and code before acting, reply and resolve threads per the CLAUDE.md rules, keep CI green. Merge needs the maintainer's admin bypass as usual.
