# Screen-level visual regression design

Date: 2026-07-25
Status: Approved

## Context

Eleventh infrastructure-queue item, pulled ahead of release operations by the maintainer. Chromatic (Architecture Decision Record (ADR) 0033) snapshots every Storybook story, but stories render components and pages in isolation against the fake bridge. Nothing captures the composed application: the router shell, the sidebar, and the pages inside the real Electron window. The maintainer set the platform decision directly: the app ships to macOS, Windows, and Linux, and platform-specific component customization is certain on the roadmap. The visual layer therefore runs the full three-platform matrix from day one. The Chromatic job evaluated and rejected Chromatic's Playwright product: it documents no Electron support, and it re-renders archives in a cloud Chrome. That re-render violates the test-the-shipped-artifact principle ADR-0031 set. Playwright's own guidance settles the baseline question: screenshots must come from the environment where the comparisons run. The continuous-integration runners are therefore the only source of truth for every platform, including macOS.

## Decisions

- **A `visual.spec.ts` joins the end-to-end suite as the fifth Playwright project.** It stays a plain Playwright spec rather than Gherkin: a pixel comparison is a technical proof, not business behavior, the same line ADR-0031 drew for the boot proof and the packaged smoke. The spec reuses the existing launch fixture with its fresh user-data seam.
- **Three screens form the initial scope.** The home empty state, the providers empty state, and the providers list after connecting an account. Each asserts with `toHaveScreenshot` against its committed baseline.
- **The full three-platform matrix runs from day one.** Playwright suffixes every baseline per platform automatically, and each matrix leg compares only against its own platform's baseline. Nine images exist at the start: three screens across three platforms.
- **Baselines live in plain git.** Nine window-sized images don't need Git Large File Storage; the ADR records the revisit trigger: adoption when the snapshot directory grows past 25 MB or measurably hurts clone times.
- **Stabilizers keep the comparisons deterministic.** The window opens at a fixed size, the spec waits for font loading to settle, and Playwright's defaults already disable animations and hide the caret. An explicit `maxDiffPixels` tolerance lands in the Playwright config, tuned from the first continuous-integration runs so the gate is green on day one and ratchets later, the ADR-0015 philosophy. Masking stays available for future dynamic regions; today's three screens have none.
- **The assertions run inside the existing required `e2e` job.** A `test:e2e:visual` script runs as a step on all three matrix legs, so the gate is transitively required through `ci-success` with no ruleset change. The quarantine policy from ADR-0031 applies unchanged.
- **A `update-visual-baselines.yml` workflow regenerates baselines on demand and commits them.** The maintainer dispatches it with a branch name. Three matrix legs run `--update-snapshots`, upload their images as artifacts, and one collector job commits every refreshed image to the branch in a single conventional commit. The workflow holds `contents: write`; it can't touch `main` because the ruleset rejects direct pushes there. This mechanism is mandatory, not convenience: the maintainer's macOS machine can't produce Windows or Linux baselines, and even the macOS baseline must come from the runner environment.
- **The initial baselines come from that workflow, on this job's own pull request.** The mechanism proves itself before it merges.
- **ADR-0034 records the decisions** through the architecture-decision-records skill.

## Testing

- The gate proves itself on its own pull request: the update workflow seeds nine baselines, and all three `e2e` legs pass their visual assertions against them.
- The update workflow runs at least twice on the pull request, the initial seed and any post-tuning refresh, which exercises the dispatch, matrix, artifact collection, and bot-commit path end to end.
- Existing acceptance, proof, leak, and packaged projects stay untouched and green.

## Out of scope

- A story-per-screen meta rule extending the story-required check to pages: a separate lever, recorded in the queue memory.
- Git Large File Storage: deferred behind the recorded trigger.
- Masking and `stylePath` usage: available, unused until a dynamic region appears.
- Screens beyond the initial three: each future screen adds its assertion when it lands.
- Platform-specific component work itself: when it lands, its baselines land with it through the same workflow.

## Risks

- Runner image updates can shift rendering and churn baselines. The tolerance absorbs subpixel noise, and a churn event costs one workflow dispatch plus a reviewed diff.
- The bot-commit path needs `contents: write`. The scope stays narrow: the dispatch input names a working branch, and protected `main` rejects any direct push. The workflow passes the same zizmor and actionlint gates as every other workflow.
- The first tolerance numbers may need an iteration or two before all three legs sit stably green; the day-one-green rule makes that tuning explicit instead of silent.
- Committed images grow the repository over time; the ADR's Large File Storage trigger bounds that growth.

## Decision record

ADR-0034 lands with the implementation through the architecture-decision-records skill. It captures the three-platform directive and its rationale, the plain-spec placement next to the other technical proofs, and the tolerance numbers with their tuning evidence. It also records the baseline-update workflow shape with its permission scope, the Chromatic-Playwright rejection, and the Large File Storage deferral trigger.
