# Chromatic visual regression design

Date: 2026-07-25
Status: Approved

## Context

Tenth infrastructure-queue item. Architecture Decision Record (ADR) 0029 landed Storybook 10.5 with six seed components and nine stories in `apps/desktop`, plus a `storybook:build` smoke inside the required `check` job. This job wires that Storybook into Chromatic for visual regression baselines. The maintainer's free-tier software-as-a-service policy, set with the Codecov gate in ADR-0022, covers Chromatic's free plan: 5,000 snapshots a month on Chrome. Nine stories cost nine snapshots a build, so the plan supports more than 500 builds a month. The repository merges through squash, which rewrites commits and orphans accepted baselines without the documented countermeasure. One rider from the Storybook ledger lands here: fake-bridge extraction. Two Vitest browser tests hand-roll the same `window.recompose` stub the Storybook decorator installs, so the fake bridge exists three times today.

## Decisions

- **A dedicated `chromatic.yml` workflow on the `push` trigger.** Chromatic's guidance rejects `pull_request` triggers: GitHub builds an ephemeral merge commit there, and Chromatic can pick a wrong baseline from it. The workflow runs on every branch push, checks out with `fetch-depth: 0` because baseline ancestry detection needs full git history, and carries no path filter so every head commit reports a status.
- **The official `chromaui/action`, pinned by commit SHA** like every other action in the repository. `workingDir` points at `apps/desktop` and `buildScriptName` at `storybook:build`. `exitZeroOnChanges: true` keeps the job green while visual diffs await review; the job fails only on real errors such as a broken Storybook build. `autoAcceptChanges: main` applies the official squash-merge countermeasure: after a merge, the `main` build accepts itself as the new baseline.
- **Chromatic's UI Tests status check becomes the required gate in the ruleset.** Accepting a diff in Chromatic's web interface flips the check green without re-running any workflow. A failed-job gate would demand a manual re-run after every acceptance. `codecov/patch` and CodeRabbit already gate through the ruleset the same way, so the mechanism has precedent. The ADR records this deviation from the `ci-success` needs convention of ADR-0007 with the cross-workflow rationale.
- **The Chromatic GitHub App, with the official pull-request comment turned on.** The App posts a self-updating comment carrying visual and accessibility change counts plus a link to the published Storybook. The comment is a per-project opt-in on the project's Manage screen. UI Review stays enabled as an informational lane the maintainer approves by hand; it never becomes a required check.
- **No TurboSnap.** It stays locked until ten continuous-integration builds complete, and at nine stories a full build costs nine snapshots. The ADR records the rejection and the revisit trigger: story growth that threatens the snapshot budget.
- **The `chromatic` command-line interface pins exact as a devDependency in `apps/desktop`.** The pin gives deterministic versions, local runs, and Renovate bump proposals.
- **The fake bridge extracts into one authoritative module.** The pure `installBridge` function and its `BridgeParameters` type leave `.storybook/recompose-bridge.tsx` for a shared module; placement follows the feature-sliced-design decision tree at implementation time. Three consumers result: the Storybook decorator keeps only its React and QueryClient wrapper, and the two browser tests, `router.browser.test.tsx` and `providers-page.browser.test.tsx`, drop their hand-rolled stubs. Test assertions stay untouched; only setup plumbing changes.
- **The `storybook:build` smoke stays in `check`** as the network-free fast signal for Storybook build breakage.
- **No lefthook leg.** Chromatic needs the network and a secret, so the standing pre-commit rule's "where applicable" clause exempts it.

## Maintainer prerequisites

- Create the Chromatic project for the repository and store `CHROMATIC_PROJECT_TOKEN` as a GitHub Actions secret.
- Install the Chromatic GitHub App on the repository.
- Turn on the pull-request comment on the project's Manage screen.
- The ruleset gains the UI Tests required check during implementation, mirroring the `codecov/patch` addition; if tooling can't edit the ruleset, the maintainer adds the check by hand.

## Testing

- The gate proves itself on its own pull request: the first build establishes baselines, the UI Tests check appears, and acceptance in Chromatic's interface flips it green without a workflow re-run.
- All nine stories and both browser tests pass unchanged after the fake-bridge extraction.
- After merge, the first `main` build accepts itself as the new baseline, and the next pull request diffs against it.

## Out of scope

- TurboSnap: the revisit trigger sits in the ADR.
- Reviewer assignment inside UI Review.
- Extra browsers and viewports: the free plan covers Chrome at one viewport.
- The open-source plan application: optional, and the snapshot volume doesn't require it.

## Risks

- A fork's `push` events run inside the fork, not in this repository, so the upstream pull request never receives the required UI Tests status and the merge blocks. The ADR records the residual and Chromatic's sanctioned fix, a plaintext project token, deferred until an external contributor appears.
- Every push costs nine snapshots, and frequent pushes consume the budget. More than 500 builds a month fit the free plan; skip globs for bot branches or TurboSnap recover headroom if pressure appears.
- A required external check blocks forever when its workflow never reports; the unconditional `push` trigger closes that gap for same-repository branches.

## Decision record

ADR-0033 lands with the implementation through the architecture-decision-records skill. It captures the Chromatic choice with the free-plan arithmetic, the `push`-trigger workflow shape, and the UI Tests ruleset gate with its deviation from ADR-0007. It also records the squash-merge countermeasure, the TurboSnap rejection with its revisit trigger, the fork residual, the pull-request comment opt-in, and the fake-bridge extraction.
