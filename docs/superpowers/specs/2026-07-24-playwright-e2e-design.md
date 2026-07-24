# Playwright end-to-end design

Date: 2026-07-24
Status: Approved

## Context

Ninth infrastructure-queue item. The desktop app ships to macOS, Windows, and Linux. The maintainer confirmed that during this brainstorm. The end-to-end layer therefore runs as a full three-platform matrix rather than the macOS-only shape the original rider assumed. Today the only end-to-end artifact is `apps/desktop/e2e/security-boot-proof.mjs`, a local-only script that launches the built `out/` bundle and proves the security baseline. Issue #58 requires a packaged-artifact smoke test that the source-mode proof can't provide. The acceptance layer uses Gherkin `.feature` files through playwright-bdd as the maintainer's approval artifact, a standing decision from the typed Inter-Process Communication (IPC) job. Two skills already landed on this branch as groundwork: the vendored `playwright-best-practices` and the authored `gherkin-best-practices`, both mandatory for any end-to-end work. The Playwright Model Context Protocol (MCP) server also landed, pinned at project scope.

## Decisions

- **playwright-bdd on Playwright's native runner.** Gherkin `.feature` files compile into Playwright tests through `defineBddConfig`, keeping fixtures, traces, retries, and parallel workers. The Cucumber runner loses those and stays out. New devDependencies pin exact in `apps/desktop`: `@playwright/test` on the already-installed 1.61 line, `playwright-bdd`, and `electron-playwright-helpers`.
- **Everything lives under `apps/desktop/e2e/`.** `features/*.feature` hold the acceptance scenarios, `steps/` holds step definitions and fixtures, and `playwright.config.ts` holds the runner configuration. Feature files follow the `gherkin-best-practices` skill; step definitions follow `playwright-best-practices` with role-based locators and web-first assertions.
- **A launch fixture with a user-data seam.** Each scenario launches the built `out/` bundle through `_electron.launch` and receives a fresh temporary user-data directory: the main process honors a `RECOMPOSE_USER_DATA_DIR` environment override before `app.ready`. Scenarios stay order-independent and never touch the developer's real settings, accounts, or vault. The override redirects a path; it isn't a privilege boundary, and an attacker controlling the environment already controls the process.
- **The acceptance suite covers the providers flow and the home screen.** `home.feature`: a fresh install shows the empty state. `providers.feature`: connecting an account lists it, and removing an account clears it. Real app, real IPC, real storage in the temporary directory. On Linux runners `safeStorage` falls back to its basic backend, which the scenarios never notice because they assert visible behavior.
- **A packaged-artifact smoke spec closes issue #58.** Continuous integration produces the platform artifact with `electron-builder --dir`, the after-pack hook still flips the fuses, and `electron-playwright-helpers` finds, parses, and launches the packaged binary. The spec asserts boot to `app://renderer`, the frozen bridge, the sandbox, `app.getAppPath()` resolving inside `app.asar`, and the fuse behavior that source-mode execution can't exercise. It stays a plain Playwright spec rather than Gherkin because it's a technical proof, not business behavior.
- **The existing boot proof migrates into the runner.** `security-boot-proof.mjs` becomes a tagged Playwright spec with unchanged scope, so one runner owns reporting and traces and the bespoke script disappears. The source-mode proof and the packaged smoke stay complementary, never duplicates.
- **A heap-growth spec covers the memory-leak rider.** fuite and memlab only drive puppeteer-launched Chrome and can't launch an Electron binary, so the Architecture Decision Record (ADR) records them as evaluated and unfit. A `@leak`-tagged spec loops home and providers navigation, forces garbage collection through the Chrome DevTools Protocol (CDP), and asserts bounded JavaScript heap growth. It runs on the ubuntu matrix leg only, because V8 heap behavior doesn't vary by platform and one leg keeps the flake surface small.
- **One required `e2e` job runs the three-platform matrix.** `strategy.matrix.os: [macos-latest, windows-latest, ubuntu-latest]`, gated by the same `changes` filter as `check`, and added to the `ci-success` needs list per ADR-0007. Each leg installs, builds, runs the acceptance suite against `out/` (ubuntu wrapped in `xvfb-run`), packages with `--dir`, and runs the packaged smoke. Retries are 2 on continuous integration with trace capture on first retry. The job downloads no browsers because Electron is the browser.
- **A non-blocking quarantine lane.** A separate `e2e-quarantine` job on ubuntu with `continue-on-error` runs only `@quarantine`-tagged tests. The main suite excludes that tag. The lane never joins `ci-success`.
- **The flaky-test policy lands in the ADR.** A flaking test gets the `@quarantine` tag plus a GitHub issue naming an owner and a two-week fix-or-remove deadline. Exit requires twenty consecutive passing quarantine runs or deletion. No third-party flake service.
- **The browser-cache rider lands on the existing `check` job.** The Chromium download for the Vitest browser project gets cached on `~/.cache/ms-playwright`, keyed on the pinned Playwright version.
- **Skills and MCP groundwork rides this branch.** Already committed: the two mandatory skills with the CLAUDE.md rule, `@playwright/mcp` pinned exact as a root devDependency launched through `pnpm exec`, and a gitleaks allowlist scoped to the `generic-api-key` rule under `.agents/skills/` that keeps the owner-alias rule scanning that path.

## Testing

- Every `.feature` scenario runs as a Playwright test on all three matrix legs and must pass for `ci-success`.
- The packaged smoke proves Atom Shell Archive (ASAR) loading, packaged-path resolution, and the fuse configuration per platform; it fails when packaged wiring breaks.
- The migrated boot proof keeps its exact current assertions against `out/`.
- The `@leak` spec fails when the heap grows beyond its bound across the navigation loop.
- The unit-test invariant stays intact: existing Vitest specs change only when behavior changes. The user-data seam gets a behavior spec at the main-process level.

## Out of scope

- Chromatic and visual regression baselines: queue item 10.
- Release packaging, signing, notarization, Software Bill of Materials (SBOM), and provenance: release-ops job.
- Provider failure-mode matrices and network-level fault injection: engine job.
- fuite or memlab adoption: rejected for Electron incompatibility, recorded in the ADR.

## Risks

- Windows and Linux runners are new territory for this app's Electron tests; first-run flakes are plausible. The quarantine policy exists from day one, so flakes have a governed path that never blocks the queue.
- `electron-builder --dir` on Windows and Linux runners may surface packaging assumptions the macOS-only history never tested. Failures there are signal, not noise: the app ships to those platforms.
- The ASAR-integrity fuse historically covers macOS and Windows more completely than Linux; the smoke asserts what each platform supports and the ADR records the per-platform expectations.
- playwright-bdd tracks Playwright releases; the exact pins keep the pair compatible and Renovate proposes coordinated bumps.

## Decision record

ADR-0030 lands with the implementation through the architecture-decision-records skill. It captures the runner choice, the three-platform matrix rationale, the quarantine policy text, and the leak-check approach with the fuite and memlab rejection. It also records the user-data seam, the MCP pinning, and the gitleaks allowlist scoping.
