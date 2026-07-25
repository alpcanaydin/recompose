# 0034: Screen-level visual regression on the real Electron shell

**Status**: Accepted
**Date**: 2026-07-25

## Context

Chromatic (Architecture Decision Record (ADR) 0033) snapshots every Storybook story, but stories render components and pages in isolation against the fake bridge. Nothing captured the composed application: the router shell, the sidebar, and the pages inside the real Electron window. The maintainer set the platform decision directly. The app ships to macOS, Windows, and Linux. Platform-specific component customization is certain on the roadmap, so the visual layer runs the full three-platform matrix from day one. Playwright's guidance settles where baselines come from. Screenshots must come from the environment where comparisons run. The continuous-integration runners are the only source of truth for every platform, including macOS.

## Decision

- **A `visual` project joins the end-to-end suite as a plain Playwright spec.** A pixel comparison is a technical proof, not business behavior, the same line ADR-0031 drew for the boot proof and the packaged smoke. The spec reuses the launch fixture with its fresh user-data seam and asserts `toHaveScreenshot` on three screens: the home empty state, the providers empty state, and the providers list after connecting an account.
- **A `snapshotPathTemplate` forces a `{platform}` suffix on every snapshot.** Playwright doesn't suffix explicitly named snapshots, so without the template the three platforms would fight over one file. Nine images exist at the start: three screens across darwin, win32, and linux.
- **Baselines live in plain git and come only from continuous integration.** The `update-visual-baselines.yml` workflow is the single producer: the maintainer dispatches it with a branch name, three matrix legs regenerate their platform's images, and one collector job commits every refreshed image to the branch in a single conventional commit. The maintainer's machine never produces a committed baseline, because even a macOS laptop renders differently from the macOS runner. Git Large File Storage stays out until the snapshot directory grows past 25 MB or measurably hurts clone times.
- **The tolerance is explicit and starts at zero.** `maxDiffPixels: 0` sits in the Playwright config. Every baseline and every comparison come from the same runner images, so zero is the honest starting point. A raise needs observed continuous-integration evidence recorded here, the same ratchet discipline ADR-0015 set.
- **The assertions run inside the required `e2e` job on all three legs.** The Linux leg runs inside the existing dbus and keyring session, because the connected-account screen exercises the vault. The gate stays transitively required through `ci-success` with no ruleset change, and the ADR-0031 quarantine policy applies unchanged.
- **The bot-commit path holds `contents: write` on the collector job alone.** Every checkout keeps `persist-credentials: false`, the branch input reaches the shell only through the environment, and protected `main` rejects any direct push by ruleset. GitHub fires no workflows for pushes made with the workflow token, so a refreshed head reports no checks until a human-authored push, a manual re-run, or a fresh dispatch creates them. A personal-access-token secret would lift that friction; it stays out until the one extra push per refresh actually hurts.
- **Chromatic's Playwright product stays rejected for this layer.** It documents no Electron support, and it re-renders archives in a cloud Chrome. That re-render tests a different artifact from the one users run, which ADR-0031's packaged-smoke rationale already forbids.

## Alternatives

- **Ubuntu-only visual assertions**: rejected by maintainer directive. The app ships to three platforms and platform-specific component customization is certain, so a single-leg gate would go blind exactly where divergence lands.
- **Chromatic's Playwright integration**: rejected. No documented Electron support, and its cloud re-render violates the test-the-shipped-artifact principle.
- **Locally generated baselines**: rejected. Playwright's own guidance requires baselines from the comparison environment, and Windows and Linux images can't come from the maintainer's machine at all.
- **Git Large File Storage from day one**: rejected. Nine window-sized images don't justify the tooling. The revisit trigger appears above.
- **Gherkin scenarios for the screenshots**: rejected. ADR-0031 reserves `.feature` files for business behavior; a pixel diff is a technical proof.

## Consequences

**Good**: a change that breaks the composed shell now fails a required check on the exact platform it breaks, with expected, actual, and diff images attached as artifacts. Platform-specific UI work gets its baselines through the same workflow the day it lands. Refreshing baselines after an intentional change costs one dispatch and one reviewed diff.

**Bad, and accepted**: runner image updates can shift rendering and churn baselines. The recovery is one dispatch plus a reviewed commit. Committed images grow the repository over time, bounded by the Large File Storage trigger. The zero tolerance may prove too strict on some leg. The first raise must carry its evidence into this record.
