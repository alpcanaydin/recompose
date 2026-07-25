# Release Operations Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `v*` tag produces a draft GitHub release with unsigned installers for three platforms, SBOM and provenance attestations, a blocking license gate, and Homebrew tap automation that fires when the maintainer publishes.

**Architecture:** `release.yml` runs a 3-OS matrix reusing the existing `build:mac`/`build:win`/`build:linux` scripts and after-pack fuse hook; each leg attests its artifacts, a collector job creates ONE draft release. A separate `homebrew-bump.yml` fires on `release: published` and pushes a cask update to `recomposesh/homebrew-tap` over a write-scoped deploy key. Everything else is config cleanup riding the same PR.

**Tech Stack:** electron-builder (existing), anchore/sbom-action (Syft, CycloneDX), actions/attest-build-provenance + attest-sbom, `pnpm licenses list --json`, Homebrew cask.

**Spec:** `docs/superpowers/specs/2026-07-25-release-ops-design.md`

## Global Constraints

- Never commit to `main`; branch `worktree-release-ops`; one PR closes the job (the tap repo is a second repository, not a second PR — the controller populates it directly).
- The forbidden owner alias (the word the gitleaks `forbidden-owner-alias` rule bans) must never appear in any artifact.
- Repo slug is `recomposesh/recompose` everywhere; the tap is `recomposesh/homebrew-tap`.
- All workflow actions pinned by full commit SHA with trailing version comment. New pins locked by this plan: `anchore/sbom-action@e22c389904149dbc22b58101806040fa8d37a610 # v0.24.0`, `actions/attest-build-provenance@0f67c3f4856b2e3261c31976d6725780e5e4c373 # v4.1.1`, `actions/attest-sbom@c604332985a26aa8cf1bdc465b92731239ec6b9e # v4.1.0`. Existing pins copy verbatim from `ci.yml`.
- Unsigned phase A: no signing config anywhere; `notarize: false` stays.
- Version becomes 0.2.0; first tag `v0.2.0` happens post-merge, never on the branch.
- No code comments (YAML pin version comments excepted, house convention). No em dashes in gated prose. ADR/docs pass Vale + cspell; plans exempt.
- Every commit: caveman style + trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## File structure

| File                                                         | Responsibility                                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `apps/desktop/electron-builder.yml`                          | Scaffold cleanup: github publish, real maintainer, drop unused permissions, drop snap |
| `apps/desktop/package.json`                                  | Version 0.2.0                                                                         |
| `scripts/check-licenses.mjs` + root `package.json`           | License allowlist gate (`lint:licenses`)                                              |
| `.github/workflows/chromatic.yml`                            | `branches: ['**']` so tags stop triggering it                                         |
| `.github/workflows/release.yml`                              | Tag-triggered 3-OS build + attestations + license gate + draft release                |
| `.github/workflows/homebrew-bump.yml`                        | On `release: published`: push cask bump to the tap                                    |
| `recomposesh/homebrew-tap` repo: `Casks/recompose.rb`        | The cask (controller-created, outside this repo)                                      |
| `docs/adr/0035-release-operations.md` + `docs/adr/README.md` | Decision record + index row                                                           |

**Parallelizable:** Tasks 1, 2, 3 touch disjoint files. Task 4 is controller-only (tap repo + key). Task 5 needs everything.

---

### Task 1: Config cleanup, version, license gate, chromatic filter

**Files:**

- Modify: `apps/desktop/electron-builder.yml`
- Modify: `apps/desktop/package.json` (version only)
- Create: `scripts/check-licenses.mjs`
- Modify: root `package.json` (one script)
- Modify: `.github/workflows/chromatic.yml` (trigger only)

**Interfaces:**

- Produces: `pnpm run lint:licenses` (exit 0 on allowlisted tree, exit 1 naming offenders) — Task 2's workflow calls it verbatim. electron-builder config whose `linux.target` is exactly AppImage+deb and whose publish block is the github provider — Task 2 relies on `latest*.yml` generation from that block.

- [ ] **Step 1: Clean `electron-builder.yml`**

Apply exactly these changes (leave every other line untouched):

1. Replace the `publish` block:

```yaml
publish:
  provider: github
  owner: recomposesh
  repo: recompose
```

2. Delete the four `extendInfo` permission lines (`NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, `NSDocumentsFolderUsageDescription`, `NSDownloadsFolderUsageDescription`) and the now-empty `extendInfo:` key.
3. In `linux`, replace the target list with:

```yaml
target:
  - AppImage
  - deb
```

4. Replace `maintainer: electronjs.org` with `maintainer: recomposesh`.
5. `notarize: false` stays exactly as is.

- [ ] **Step 2: Bump the version**

In `apps/desktop/package.json`: `"version": "0.1.0"` → `"version": "0.2.0"`.

- [ ] **Step 3: Write the license gate**

`scripts/check-licenses.mjs`:

```js
import { execFileSync } from 'node:child_process';

const allowlist = new Set([
  '0BSD',
  'Apache-2.0',
  'BlueOak-1.0.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'CC-BY-4.0',
  'CC0-1.0',
  'ISC',
  'MIT',
  'MPL-2.0',
  'Python-2.0',
  'Unlicense',
]);

const raw = execFileSync('pnpm', ['licenses', 'list', '--prod', '--json'], {
  encoding: 'utf8',
});
const byLicense = JSON.parse(raw);

const offenders = Object.entries(byLicense)
  .filter(([license]) => !allowlist.has(license))
  .flatMap(([license, packages]) =>
    packages.map((pkg) => `${pkg.name}@${pkg.versions.join(',')} (${license})`),
  );

if (offenders.length > 0) {
  console.error('licenses outside the allowlist:');
  for (const offender of offenders) {
    console.error(`  ${offender}`);
  }
  process.exit(1);
}

console.log(
  `license gate passed: ${Object.keys(byLicense).length} distinct licenses, all allowlisted`,
);
```

Root `package.json` scripts, alongside the other `lint:*` entries:

```json
"lint:licenses": "node scripts/check-licenses.mjs",
```

- [ ] **Step 4: Run the gate against today's tree**

Run: `pnpm run lint:licenses`
Expected: exit 0. If it fails, the offending license is either a legitimate allowlist addition (add it, alphabetically, and record the package in your report for the ADR) or a real problem to escalate. Day-one-green: the committed allowlist must pass on the current lockfile.

- [ ] **Step 5: Add the chromatic tag filter**

In `.github/workflows/chromatic.yml`, change:

```yaml
on:
  push:
```

to:

```yaml
on:
  push:
    branches: ['**']
```

- [ ] **Step 6: Gates and commit**

Run: `pnpm exec turbo run lint typecheck && pnpm run fmt:check && pnpm run lint:spell`
Expected: PASS.

```bash
git add apps/desktop/electron-builder.yml apps/desktop/package.json scripts/check-licenses.mjs package.json .github/workflows/chromatic.yml
git commit -m "build: release-ready config and license gate

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: The release workflow

**Files:**

- Create: `.github/workflows/release.yml`

**Interfaces:**

- Consumes: `pnpm run lint:licenses` and the cleaned electron-builder config from Task 1; the existing `build:mac`/`build:win`/`build:linux` scripts (each runs typecheck + build + electron-builder with config-default targets).
- Produces: on a `v*` tag, one draft release holding every artifact; attestations on every installer.

- [ ] **Step 1: Create the workflow**

`.github/workflows/release.yml` (checkout/pnpm/node/harden-runner pins copied verbatim from `ci.yml`; new pins from Global Constraints):

```yaml
name: release

on:
  push:
    tags: ['v*']

permissions:
  contents: read

concurrency:
  group: release-${{ github.ref }}
  cancel-in-progress: false

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}
    permissions:
      contents: read
      id-token: write
      attestations: write
    steps:
      - uses: step-security/harden-runner@bf7454d06d71f1098171f2acdf0cd4708d7b5920 # v2.20.0
        with:
          egress-policy: audit
        if: runner.os == 'Linux'
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
        with:
          persist-credentials: false
      - uses: pnpm/action-setup@0ebf47130e4866e96fce0953f49152a61190b271 # v6
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile --trust-lockfile
      - run: pnpm --filter @recompose/desktop exec node node_modules/electron/install.js
      - run: pnpm run lint:licenses
      - if: runner.os == 'macOS'
        run: pnpm --filter @recompose/desktop run build:mac
      - if: runner.os == 'Windows'
        run: pnpm --filter @recompose/desktop run build:win
      - if: runner.os == 'Linux'
        run: pnpm --filter @recompose/desktop run build:linux
      - id: artifacts
        shell: bash
        run: |
          mkdir -p release-out
          find apps/desktop/dist -maxdepth 1 -type f \
            \( -name '*.dmg' -o -name '*.zip' -o -name '*.exe' -o -name '*.AppImage' -o -name '*.deb' \
               -o -name '*.blockmap' -o -name 'latest*.yml' \) \
            -exec cp {} release-out/ \;
          ls -la release-out
      - uses: anchore/sbom-action@e22c389904149dbc22b58101806040fa8d37a610 # v0.24.0
        with:
          path: apps/desktop/dist
          format: cyclonedx-json
          output-file: release-out/sbom-${{ runner.os }}.cdx.json
          upload-artifact: false
          upload-release-assets: false
      - uses: actions/attest-build-provenance@0f67c3f4856b2e3261c31976d6725780e5e4c373 # v4.1.1
        with:
          subject-path: |
            release-out/*.dmg
            release-out/*.zip
            release-out/*.exe
            release-out/*.AppImage
            release-out/*.deb
      - uses: actions/attest-sbom@c604332985a26aa8cf1bdc465b92731239ec6b9e # v4.1.0
        with:
          subject-path: |
            release-out/*.dmg
            release-out/*.zip
            release-out/*.exe
            release-out/*.AppImage
            release-out/*.deb
          sbom-path: release-out/sbom-${{ runner.os }}.cdx.json
      - uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
        with:
          name: release-${{ runner.os }}
          path: release-out/
          retention-days: 3

  draft:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: step-security/harden-runner@bf7454d06d71f1098171f2acdf0cd4708d7b5920 # v2.20.0
        with:
          egress-policy: audit
      - uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8.0.1
        with:
          pattern: release-*
          merge-multiple: true
          path: assets/
      - run: gh release create "$TAG" assets/* --repo "$REPO" --draft --generate-notes --title "$TAG"
        env:
          GH_TOKEN: ${{ github.token }}
          TAG: ${{ github.ref_name }}
          REPO: ${{ github.repository }}
```

Notes locked by the spec: zip on macOS comes from the config's default mac targets (dmg+zip); `latest*.yml` and `.blockmap` upload as release assets for phase B; the license gate runs on every leg before any build; the draft is created exactly once by the collector.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: tag-triggered draft release with attestations

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

actionlint and zizmor gate the YAML on the PR (no local runners).

---

### Task 3: Homebrew bump workflow and ADR-0035

**Files:**

- Create: `.github/workflows/homebrew-bump.yml`
- Create: `docs/adr/0035-release-operations.md`
- Modify: `docs/adr/README.md` (one row)

**Interfaces:**

- Consumes: a repo secret `TAP_DEPLOY_KEY` (an ed25519 private key; the controller creates it in Task 4 — reference it, don't create it) whose public half is a write-scoped deploy key on `recomposesh/homebrew-tap`.
- Produces: on `release: published`, an updated `Casks/recompose.rb` in the tap.

- [ ] **Step 1: Create the bump workflow**

`.github/workflows/homebrew-bump.yml`:

```yaml
name: homebrew-bump

on:
  release:
    types: [published]

permissions:
  contents: read

jobs:
  bump:
    runs-on: ubuntu-latest
    steps:
      - uses: step-security/harden-runner@bf7454d06d71f1098171f2acdf0cd4708d7b5920 # v2.20.0
        with:
          egress-policy: audit
      - shell: bash
        run: |
          version="${TAG#v}"
          dmg_url=$(gh api "repos/${REPO}/releases/tags/${TAG}" \
            --jq '.assets[] | select(.name | endswith(".dmg")) | .browser_download_url' | head -1)
          if [ -z "$dmg_url" ]; then
            echo "no dmg asset on release ${TAG}"
            exit 1
          fi
          curl -sL "$dmg_url" -o app.dmg
          sha=$(sha256sum app.dmg | cut -d' ' -f1)
          mkdir -p ~/.ssh
          printf '%s\n' "$DEPLOY_KEY" > ~/.ssh/tap_key
          chmod 600 ~/.ssh/tap_key
          ssh-keyscan github.com >> ~/.ssh/known_hosts 2>/dev/null
          export GIT_SSH_COMMAND="ssh -i ~/.ssh/tap_key -o UserKnownHostsFile=~/.ssh/known_hosts"
          git clone git@github.com:recomposesh/homebrew-tap.git tap
          cd tap
          cat > Casks/recompose.rb <<CASK
          cask "recompose" do
            version "${version}"
            sha256 "${sha}"

            url "${dmg_url}"
            name "recompose"
            desc "Local-first AI gateway composer"
            homepage "https://github.com/recomposesh/recompose"

            depends_on arch: :arm64

            app "recompose.app"
          end
          CASK
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add Casks/recompose.rb
          if git diff --cached --quiet; then
            echo "cask already current"
            exit 0
          fi
          git commit -m "recompose ${version}"
          git push origin HEAD:main
        env:
          GH_TOKEN: ${{ github.token }}
          TAG: ${{ github.event.release.tag_name }}
          REPO: ${{ github.repository }}
          DEPLOY_KEY: ${{ secrets.TAP_DEPLOY_KEY }}
```

Security shape: the deploy key reaches the shell only through `env`, grants write on the tap alone, and the event payload values (`tag_name`) come through `env`, never inline interpolation.

- [ ] **Step 2: Write ADR-0035**

`docs/adr/0035-release-operations.md`, exactly:

```markdown
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

**Bad, and accepted**: Gatekeeper and SmartScreen friction stands until phase B, and the README owns explaining the right-click path. The first live run of a tag-triggered workflow happens after merge, bounded by the draft decision. The cask serves arm64 only, matching the built artifact; Intel Macs wait for universal binaries in phase B.
```

- [ ] **Step 3: Append the index row**

In `docs/adr/README.md`, after the 0034 row:

```markdown
| [0035](0035-release-operations.md) | Release Operations, Unsigned Phase A, and the Homebrew Tap | Accepted | 2026-07-25 |
```

Run `pnpm run fmt` then `pnpm run fmt:check`.

- [ ] **Step 4: Prose gates**

Run: `pnpm run lint:prose && pnpm run lint:spell`
Expected: 0 errors. Fix only by rewording THIS ADR (contractions, sentence splits, acronym expansion at first use); never touch vocabulary files or other documents.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/homebrew-bump.yml docs/adr/0035-release-operations.md docs/adr/README.md
git commit -m "docs(adr): release operations record and cask bump workflow

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Tap repository and deploy key (controller-only, no subagent)

The controller performs these directly; they touch a different repository and secrets.

- [ ] **Step 1: Create the tap repo**

```bash
gh repo create recomposesh/homebrew-tap --public --description "Homebrew tap for recompose"
```

- [ ] **Step 2: Seed it**

Clone to a temp dir, add `Casks/recompose.rb` with a placeholder pointing at the upcoming v0.2.0 asset (the bump workflow overwrites it on first publish), plus a one-paragraph `README.md` (`brew tap recomposesh/tap && brew install recompose`), commit, push to `main`.

- [ ] **Step 3: Deploy key + secret**

```bash
ssh-keygen -t ed25519 -N "" -C "recompose-tap-bump" -f /tmp/tap_key
gh repo deploy-key add /tmp/tap_key.pub --repo recomposesh/homebrew-tap --title "cask bump from recompose releases" --allow-write
gh secret set TAP_DEPLOY_KEY --repo recomposesh/recompose < /tmp/tap_key
rm /tmp/tap_key /tmp/tap_key.pub
```

---

### Task 5: PR, merge, tag, live proof (controller-led)

- [ ] **Step 1: Push, open the PR** (title `build: release pipeline phase a`, body summarizing the five deliverables, test-plan checkboxes for the post-merge proof, standard footer).
- [ ] **Step 2: CI green + CodeRabbit threads settled** (standard flow; the new app installs on the org get their first live exercise here — if a required status never reports, check the app's org installation before debugging anything else).
- [ ] **Step 3: Merge** (attempt `gh pr merge --squash --admin` once; hand the command to the maintainer if the classifier declines).
- [ ] **Step 4: Tag and watch**

```bash
git -C ~/Projects/recompose checkout main && git -C ~/Projects/recompose pull
git -C ~/Projects/recompose tag v0.2.0 && git -C ~/Projects/recompose push origin v0.2.0
```

Watch the release run: three legs green, license gate logs "license gate passed", draft release exists with dmg, zip, exe, AppImage, deb, blockmaps, `latest*.yml`.

- [ ] **Step 5: Verify provenance**

```bash
gh release download v0.2.0 --repo recomposesh/recompose --pattern '*.AppImage' --dir /tmp/rel-verify
gh attestation verify /tmp/rel-verify/*.AppImage --repo recomposesh/recompose
```

Expected: attestation verified (provenance + SBOM subjects listed).

- [ ] **Step 6: Hand publish to the maintainer.** The draft stays for their review; publishing fires `homebrew-bump`, whose run gets watched to a green cask commit in the tap. That watch plus the memory/worktree housekeeping close the job.
