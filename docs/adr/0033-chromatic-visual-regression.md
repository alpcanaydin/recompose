# 0033: Chromatic visual regression, the UI Tests gate, and the fake-bridge extraction

**Status**: Accepted
**Date**: 2026-07-25

## Context

The tenth infrastructure-queue item wires the Storybook workshop from Architecture Decision Record (ADR) 0029 into visual regression testing. Six seed components and nine stories exist in `apps/desktop`, and a `storybook:build` smoke already runs inside the required `check` job. The free-tier policy from ADR-0022 allows Chromatic's free plan: 5,000 Chrome snapshots a month. Nine stories cost nine snapshots a build, which supports more than 500 builds a month. The repository merges through squash, which rewrites commits and orphans accepted baselines unless the workflow applies the documented countermeasure. One rider from the Storybook ledger landed here: the fake bridge existed three times, once in the Storybook decorator and once in each of two Vitest browser tests.

## Decision

- **A dedicated `chromatic.yml` workflow runs on the `push` trigger.** Chromatic's guidance rejects `pull_request` triggers because GitHub builds an ephemeral merge commit there, and Chromatic can pick a wrong baseline from it. The workflow carries no path filter, so every head commit reports a status, and it checks out with `fetch-depth: 0` because baseline ancestry detection needs full git history.
- **The official `chromaui/action` runs the publish, pinned by commit SHA to v18.1.0.** `workingDir` points at `apps/desktop` and `buildScriptName` at `storybook:build`. The `chromatic` command-line interface also pins exact at 18.1.0 as a devDependency, so Renovate proposes coordinated bumps and local runs match the action.
- **Chromatic's UI Tests status check is the required gate, added to the ruleset.** Accepting a diff in Chromatic's web interface flips the check green without re-running any workflow. A failed-job gate would demand a manual re-run after every acceptance, so `exitZeroOnChanges: true` keeps the job green while diffs await review, and the job fails only on real errors such as a broken Storybook build. This deviates from the ADR-0007 convention that gates join the `ci-success` needs list: a `push`-triggered workflow lives outside the `ci` workflow and can't join its needs. `codecov/patch` (integration 254) and CodeRabbit already gate through the ruleset the same way; UI Tests joins them with the Chromatic.com integration (47100).
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
- **Keeping three fake bridges**: rejected. The stub encodes one piece of knowledge, the fake Inter-Process Communication (IPC) contract behavior, and Don't Repeat Yourself applies to knowledge.

## Consequences

**Good**: every pull request gets a visual diff against the accepted baseline, blocked until a human accepts. The PR comment surfaces change counts and the published Storybook without leaving GitHub. Merged work never re-blocks, because `main` builds accept themselves. The fake bridge has one authoritative implementation.

**Bad, and accepted**: a fork's `push` events run inside the fork, not in this repository. The upstream pull request never receives the required UI Tests status, so the merge blocks. Chromatic's sanctioned fix, a plaintext project token in the workflow, waits until an external contributor appears. The token only uploads builds and grants no account access. Every push costs nine snapshots against the 5,000 monthly budget. Skip globs for bot branches or TurboSnap recover headroom if pressure appears. A required external check depends on Chromatic's availability: an outage blocks merges until it recovers or the maintainer bypasses with admin rights.
