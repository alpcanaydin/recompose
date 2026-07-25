# 0035: Release operations, unsigned phase A, and the Homebrew tap

**Status**: Accepted
**Date**: 2026-07-25

## Context

No release had ever shipped: version 0.1.0 was scaffold-only, `electron-builder.yml` carried template defaults, and continuous integration built only unpacked directories for the end-to-end suite. The maintainer holds no signing accounts yet and wants the app distributed now, including through Homebrew. The repository moved to the `recomposesh` organization the same day, which the publish configuration and the tap naming follow.

## Decision

- **Phase A ships unsigned; phase B adds trust.** Phase A delivers the whole pipeline: tag-triggered builds, a supply chain gate, draft releases, and Homebrew. Phase B adds macOS signing and notarization (Apple Developer Program), Windows signing (Azure Artifact Signing), automatic updates through electron-updater, the fail-when-unsigned flag, universal macOS binaries, and the official cask migration. The trigger is the maintainer opening the accounts. Until then macOS users right-click to open, Windows users click through SmartScreen, and updates arrive by reinstalling.
- **A `v*` tag drives `release.yml`.** The maintainer bumps the version in a pull request, merges, and pushes the tag by hand. Release automation bots stay out; Conventional Commits keep that door open, and GitHub's generated notes serve as the changelog.
- **Three legs build the shipped formats.** macOS produces `dmg` plus `zip` on the arm64 runner, Windows produces the Nullsoft Scriptable Install System (NSIS) setup, and Linux produces AppImage plus deb. Snap dropped out: it demands Snap Store credentials and snapcraft machinery for no current audience. The `latest*.yml` metadata and `.blockmap` files upload with every release so phase B's updater finds history in place.
- **The release lands as a draft.** One collector job creates a single draft with generated notes and every artifact. Unsigned artifacts deserve a human's last look, so the maintainer presses publish.
- **A supply chain gate blocks bad releases.** Every leg runs the license gate first: `pnpm licenses list --prod --json` against the committed allowlist in `scripts/check-licenses.mjs`, failing on anything outside it. Syft then produces a CycloneDX Software Bill of Materials (SBOM) per platform, and `actions/attest-build-provenance` plus `actions/attest-sbom` attach attestations to every installer. `gh attestation verify` proves the chain on any downloaded artifact.
- **Homebrew ships through the organization's own tap.** `recomposesh/homebrew-tap` carries the `recompose` cask: `brew tap recomposesh/tap`, then `brew install recompose`. A `homebrew-bump` workflow fires when the maintainer publishes a release, downloads the dmg, computes its hash, and pushes the cask over a deploy key scoped to the tap alone. The official `homebrew-cask` repository waits: its notability bar and its Gatekeeper stance both need phase B or later.
- **The chromatic workflow gained `branches: ['**']`.** Release tags stopped re-triggering a visual build Chromatic had already accepted, closing the recorded finding from the Chromatic job's final review.

## Alternatives

- **Waiting for signing accounts before any release**: rejected. The pipeline, the gate, and the tap carry no signing dependency, and shipping something beats shipping nothing.
- **release-please or changesets automation**: rejected for now. One maintainer, low release cadence, and a bot pull request that fights the meta-gates costs more than a hand-pushed tag.
- **Snap and the stores**: rejected. Credentials, review queues, and machinery for zero current users.
- **A personal-access token for the tap push**: rejected. A deploy key scopes write to one cosmetic repository; a token leak would burn more.
- **Publishing releases automatically on tag**: rejected. A draft costs one click and buys a last human look at unsigned artifacts.

## Consequences

**Good**: a release is one version-bump pull request plus one tag. Every artifact carries verifiable provenance and an SBOM, and no release ships with a license outside the allowlist. Homebrew users get the app with two commands, and the cask updates itself on publish.

**Bad, and accepted**: Gatekeeper and SmartScreen friction stands until phase B, and the README owns explaining the right-click path. The first live run of a tag-triggered workflow happens after merge, bounded by the draft decision. The cask serves arm64 only, matching the built artifact. Intel Macs wait for universal binaries in phase B.
