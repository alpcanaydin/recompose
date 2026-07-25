# Release operations design

Date: 2026-07-25
Status: Approved

## Context

Final infrastructure-queue item. The app ships to macOS, Windows, and Linux. The repository moved to the `recomposesh` organization on the same day this design landed. No release has ever shipped. The app version sits at 0.1.0. `electron-builder.yml` still carries scaffold defaults: a placeholder update URL, an upstream maintainer field, and unused camera and microphone permission strings. Continuous integration builds only unpacked `--dir` artifacts for the end-to-end suite. The maintainer holds no signing accounts yet and chose to ship the first releases unsigned. Phase A builds the whole pipeline now. Phase B adds signing, notarization, and automatic updates when the Apple Developer and Azure Artifact Signing accounts exist. Unsigned artifacts install and run everywhere. The cost: a Gatekeeper right-click on first launch for macOS, a SmartScreen warning on Windows, and no automatic updates, because macOS refuses unsigned ones. The maintainer also wants the app on Homebrew.

## Decisions

- **A `release.yml` workflow triggers on `v*` tag pushes.** The maintainer bumps the app version in a pull request, merges, then pushes the tag by hand. No release automation bot: Conventional Commits stay available for one later, and GitHub's generated release notes serve as the changelog.
- **Three matrix legs build the real installers.** macOS produces `dmg` and `zip` on the arm64 runner; the zip feeds automatic updates later, and universal binaries wait for phase B. Windows produces the Nullsoft Scriptable Install System (NSIS) setup. Linux produces AppImage and deb; snap drops out because it demands Snap Store credentials and snapcraft machinery for no current audience. Each leg runs the existing after-pack fuse hook and uploads its artifacts plus the `latest*.yml` metadata and `.blockmap` files electron-updater will want in phase B.
- **The release lands as a draft.** A collector job creates one draft GitHub release with generated notes and every artifact attached. The maintainer reviews and presses publish; unsigned artifacts deserve a human's last look.
- **A supply chain gate runs before the draft exists.** Syft generates a CycloneDX Software Bill of Materials (SBOM) per artifact, `actions/attest-sbom` and `actions/attest-build-provenance` attach attestations (`id-token: write`, `attestations: write`), and a license gate walks the dependency tree through `pnpm licenses list --json` against a committed allowlist (`MIT`, `Apache-2.0`, `BSD` variants, `ISC`, and peers). A license outside the list fails the release; the gate blocks, never advises.
- **Homebrew ships through the organization's own tap.** A new `recomposesh/homebrew-tap` repository carries the `recompose` cask, so users run `brew tap recomposesh/tap` once and `brew install recompose` after. A workflow in the main repository fires on the `release: published` event, computes the dmg's sha256, and pushes the cask bump to the tap over a write-scoped deploy key stored as a secret. The official `homebrew-cask` repository stays out of reach for now: its notability bar and its stance on Gatekeeper friction both point at phase B or later, and the Architecture Decision Record (ADR) records that migration trigger.
- **`electron-builder.yml` sheds its scaffold defaults.** The publish block points at the GitHub provider under `recomposesh`, the maintainer field names the real maintainer, and the unused camera, microphone, Documents, and Downloads permission strings leave. `notarize: false` stays with a phase-B marker.
- **The chromatic workflow ignores tags.** Its bare `push` trigger gains `branches: ['**']`, so release tags stop re-running a build Chromatic already accepted (the recorded finding from the Chromatic job's final review).
- **The version bump to 0.2.0 rides this pull request.** The first tag is `v0.2.0`; 0.1.0 stays the never-released scaffold number.
- **ADR-0035 records the decisions** through the architecture-decision-records skill, including the phase split and its trigger, the snap and release-bot rejections, the draft rationale, the supply chain mechanics, and the Homebrew tap choice.

## Phase B, recorded but not built

Phase B covers signing and notarization for macOS (Apple Developer Program), Windows signing through Azure Artifact Signing, and `electron-updater` wiring with the update feed on GitHub releases. It also covers the fail-when-unsigned flag in continuous integration, universal macOS binaries, and the official cask migration. Phase B starts when the maintainer opens the accounts.

## Testing

- The pull request carries only inert configuration (the release workflow ignores every event except `v*` tags), so the existing gates prove the YAML and configs.
- The live proof runs after merge: push `v0.2.0`, watch three legs build, the license gate pass, attestations attach, and one draft release appear with every artifact.
- `gh attestation verify` against a downloaded artifact proves the provenance chain.
- The tap bump proves itself when the maintainer publishes the draft; until then the tap repository holds a cask pointing at the first published release.

## Out of scope

- Everything listed under phase B.
- Update server choices: `update.electronjs.org` gets evaluated in phase B alongside electron-updater.
- Store distribution (Mac App Store, Microsoft Store, Snap Store, Flathub).
- Release cadence and support policy: process, not infrastructure.

## Risks

- Unsigned artifacts draw Gatekeeper and SmartScreen friction; the README and release notes state the right-click path plainly until phase B lands.
- The tag-triggered workflow can't run before a tag exists, so its first real execution happens post-merge; actionlint and zizmor gate the YAML in the pull request, and the draft decision bounds the blast radius of a first-run surprise.
- The deploy key grants write on the tap repository alone; a leak burns a cosmetic cask, not the main repository.
- `pnpm licenses list` reads the lockfile's resolved licenses; a dependency with a wrongly declared license slips through any scanner, and the allowlist plus lockfile review remain the human backstop.

## Decision record

ADR-0035 lands with the implementation through the architecture-decision-records skill. It captures the phase split with its account trigger, the tag-push model and the release-bot rejection, and the draft-release rationale. It also records the target set with the snap rejection and the supply chain gate mechanics. The Homebrew own-tap decision, its official-cask migration trigger, and the deploy-key scope argument close the record.
