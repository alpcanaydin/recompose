# Architecture decision records

This index records every technical decision in recompose (see `CLAUDE.md`). For a new decision record: copy the lightweight format of an existing one, number it sequentially, and add a row below. Never edit an accepted decision record: supersede it with a new one and update its status.

## Index

| Record                                                                      | Title                                                                               | Status     | Date       |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------- | ---------- |
| [0001](0001-electron-as-desktop-shell.md)                                   | Electron as Desktop Shell                                                           | Accepted   | 2026-07-21 |
| [0002](0002-engine-in-electron-utilityprocess.md)                           | Gateway Engine Runs in Electron's utilityProcess                                    | Accepted   | 2026-07-21 |
| [0003](0003-scaffold-with-electron-vite.md)                                 | Scaffold with electron-vite                                                         | Accepted   | 2026-07-21 |
| [0004](0004-pnpm-workspaces-turborepo.md)                                   | pnpm Workspaces + Turborepo                                                         | Accepted   | 2026-07-21 |
| [0005](0005-single-port-path-per-gateway.md)                                | Single Port, Path per Gateway, Both Dialects Always                                 | Superseded | 2026-07-21 |
| [0006](0006-local-quality-gate-layer.md)                                    | Local Quality Gate Layer                                                            | Accepted   | 2026-07-21 |
| [0007](0007-ci-layer.md)                                                    | CI Layer                                                                            | Accepted   | 2026-07-22 |
| [0008](0008-liquid-glass-window-chrome.md)                                  | Liquid Glass Window Chrome via electron-liquid-glass                                | Accepted   | 2026-07-22 |
| [0009](0009-two-tier-design-tokens.md)                                      | Two-Tier Design Tokens on Tailwind v4                                               | Accepted   | 2026-07-22 |
| [0010](0010-folder-structure-fsd-and-enforced-boundaries.md)                | Folder Structure, Feature-Sliced Renderer, Enforced Boundaries                      | Accepted   | 2026-07-22 |
| [0011](0011-repo-guards-forbidden-alias-and-protected-main.md)              | Repo Guards: Forbidden Owner Alias, Locally Protected Main                          | Accepted   | 2026-07-22 |
| [0012](0012-vitest-testing-foundation.md)                                   | Vitest Testing Foundation with Browser Mode and Property Testing                    | Accepted   | 2026-07-23 |
| [0013](0013-coderabbit-required-status-check.md)                            | CodeRabbit Review as Required Status Check                                          | Accepted   | 2026-07-23 |
| [0014](0014-dependency-boundaries-enforcement.md)                           | Dependency Boundaries Enforced by dependency-cruiser and Steiger                    | Accepted   | 2026-07-23 |
| [0015](0015-repo-hardening-layer.md)                                        | Repo Hardening Layer                                                                | Accepted   | 2026-07-23 |
| [0016](0016-storage-architecture.md)                                        | Storage, JSON Configs, safeStorage Vault, node:sqlite Usage Log                     | Accepted   | 2026-07-23 |
| [0017](0017-tanstack-router-file-based-in-app-layer.md)                     | TanStack Router, File-Based, Inside the Feature-Sliced App Layer                    | Accepted   | 2026-07-23 |
| [0018](0018-typed-ipc-with-result-envelope.md)                              | Typed Main-Renderer Channels, Contracts-Defined, with a Result Envelope             | Accepted   | 2026-07-23 |
| [0019](0019-vercel-remote-cache-for-turbo.md)                               | Vercel Remote Cache for Turborepo                                                   | Accepted   | 2026-07-23 |
| [0020](0020-jscpd-duplicate-code-gate.md)                                   | jscpd Duplicate-Code Gate at Zero Threshold                                         | Accepted   | 2026-07-23 |
| [0021](0021-cyclomatic-complexity-ceiling.md)                               | Cyclomatic Complexity Ceiling of 5 via oxlint                                       | Accepted   | 2026-07-23 |
| [0022](0022-codecov-patch-coverage-gate.md)                                 | Patch Coverage Gate via Codecov                                                     | Accepted   | 2026-07-23 |
| [0023](0023-type-level-tests.md)                                            | Type-Level Tests for Load-Bearing Derived Types                                     | Accepted   | 2026-07-24 |
| [0024](0024-type-aware-unsafe-lint.md)                                      | Full Type-Aware Lint, Config-Driven                                                 | Accepted   | 2026-07-24 |
| [0025](0025-vale-prose-gate.md)                                             | Vale Prose Gate with Microsoft Style at Full Strength                               | Accepted   | 2026-07-24 |
| [0026](0026-pr-meta-gate.md)                                                | A Meta-Gate Machine-Checks Pull Requests for Tests and Records                      | Accepted   | 2026-07-24 |
| [0027](0027-cspell-single-spelling-authority.md)                            | cspell Is the Single Spelling Authority                                             | Accepted   | 2026-07-24 |
| [0028](0028-security-baseline.md)                                           | Security Baseline: app:// Scheme, Sandbox, Fuses, Deny-by-Default                   | Accepted   | 2026-07-24 |
| [0029](0029-storybook-component-workshop.md)                                | Storybook Component Workshop, Blocking Gates, and the Assistant Posture             | Accepted   | 2026-07-24 |
| [0030](0030-vale-exclusions-in-config.md)                                   | One Exclusion List for the Prose Gate                                               | Accepted   | 2026-07-25 |
| [0031](0031-playwright-end-to-end.md)                                       | Playwright End-to-End Testing, the Three-Platform Matrix, and the Quarantine Policy | Accepted   | 2026-07-25 |
| [0032](0032-renovate-pin-bumps-adr-exempt.md)                               | Renovate Pin Bumps Take the adr-exempt Escape Hatch Automatically                   | Accepted   | 2026-07-25 |
| [0033](0033-chromatic-visual-regression.md)                                 | Chromatic Visual Regression, the UI Tests Gate, and the Fake-Bridge Extraction      | Accepted   | 2026-07-25 |
| [0034](0034-screen-level-visual-regression.md)                              | Screen-Level Visual Regression on the Real Electron Shell, Three-Platform Baselines | Accepted   | 2026-07-25 |
| [0035](0035-release-operations.md)                                          | Release Operations, Unsigned Phase A, and the Homebrew Tap                          | Accepted   | 2026-07-25 |
| [0036](0036-stryker-mutation-gate.md)                                       | Stryker Mutation Gate Over the Node-Tested Surfaces                                 | Accepted   | 2026-07-26 |
| [0037](0037-openspec-artifact-layer.md)                                     | OpenSpec as the Artifact Layer for the Feature Cycle                                | Accepted   | 2026-07-26 |
| [0038](0038-feature-cycle-process.md)                                       | The Feature Cycle as an Executable Process                                          | Accepted   | 2026-07-26 |
| [0039](0039-review-pass-marker-and-path-guard.md)                           | The Review Marker and the Blast-Radius Path Guard                                   | Superseded | 2026-07-27 |
| [0040](0040-edit-time-test-first-gate.md)                                   | The Edit-Time Test-First Gate                                                       | Accepted   | 2026-07-27 |
| [0041](0041-discovery-workflow-and-citation-validator.md)                   | The Discovery Workflow and the Citation Validator                                   | Accepted   | 2026-07-28 |
| [0042](0042-no-worktree-setup-script.md)                                    | Worktree Seeding Stays with the Toolchain                                           | Accepted   | 2026-07-28 |
| [0043](0043-hig-audit-and-tailwind-rules.md)                                | Three Layers for Apple Interface Conformance                                        | Accepted   | 2026-07-29 |
| [0044](0044-base-ui-shared-component-base.md)                               | Base UI as the Base of the Shared Kit                                               | Accepted   | 2026-07-29 |
| [0045](0045-launch-at-login-absent-on-linux.md)                             | Launch at Login Never Renders on Linux                                              | Accepted   | 2026-07-29 |
| [0046](0046-open-config-folder-over-reveal.md)                              | The Config Folder Opens Through shell.openPath                                      | Accepted   | 2026-07-29 |
| [0047](0047-gateway-token-vault-and-clipboard.md)                           | The Gateway Token Lives in the Vault and Copies Through Main                        | Accepted   | 2026-07-29 |
| [0048](0048-visual-baselines-regenerate-from-a-label.md)                    | Visual Baselines Regenerate From a Pull-Request Label                               | Accepted   | 2026-07-29 |
| [0049](0049-stories-guard-runs-before-the-pull-request.md)                  | The Stories Guard Runs Before the Pull Request                                      | Accepted   | 2026-07-29 |
| [0050](0050-patch-coverage-target-moves-to-95.md)                           | The Patch Coverage Target Moves to 95 Percent                                       | Accepted   | 2026-07-29 |
| [0051](0051-the-review-status-guard-stops-blocking-the-merge.md)            | The Adversarial Review Leaves Continuous Integration                                | Accepted   | 2026-07-30 |
| [0052](0052-the-dev-entry-point-fetches-the-electron-binary.md)             | The Dev Entry Point Fetches the Electron Binary                                     | Accepted   | 2026-07-30 |
| [0053](0053-flow-green-is-a-canvas-token-the-palette-does-not-carry-yet.md) | Flow Green Is a Canvas Token the Palette Doesn't Carry Yet                          | Accepted   | 2026-07-30 |
| [0054](0054-a-newer-settings-document-is-a-typed-failure.md)                | A Newer Settings Document Is a Typed Failure, Not Damage                            | Accepted   | 2026-07-30 |
| [0055](0055-app-icon-identity-and-recompose-presentation.md)                | The App Icon Identity and the Recompose Presentation                                | Accepted   | 2026-07-30 |
| [0056](0056-each-gateway-owns-its-own-loopback-port.md)                     | Each Gateway Owns Its Own Loopback Port                                             | Accepted   | 2026-07-31 |
| [0057](0057-the-engine-serves-over-hono.md)                                 | The Engine Serves Over Hono                                                         | Accepted   | 2026-07-31 |
| [0058](0058-lifecycle-state-pushes-over-a-typed-event-map.md)               | Lifecycle State Pushes Over a Typed Event Map                                       | Accepted   | 2026-07-31 |
| [0059](0059-the-slug-rule-tightens-to-a-device-safe-identifier.md)          | The Slug Rule Tightens to a Bounded, Device-Safe Identifier                         | Accepted   | 2026-07-31 |
| [0060](0060-the-permission-policy-allows-one-clipboard-write.md)            | The Permission Policy Allows One Clipboard Write                                    | Accepted   | 2026-07-31 |
| [0061](0061-the-slug-comes-from-the-name.md)                                | The Slug Comes From the Name, Folded by Hand                                        | Accepted   | 2026-07-31 |
| [0062](0062-a-schema-version-names-one-shape.md)                            | A Schema Version Names One Shape, and Every Store Reads It First                    | Accepted   | 2026-07-31 |
| [0063](0063-gateway-ports-come-from-a-recompose-band.md)                    | Gateway Ports Come From a recompose Band, Not the Ephemeral Pool                    | Accepted   | 2026-07-31 |
| [0064](0064-the-window-controls-follow-the-sidebar.md)                      | The Window Controls Follow the Sidebar                                              | Accepted   | 2026-07-31 |
| [0065](0065-view-state-stays-in-the-renderer.md)                            | View State Stays in the Renderer, Apart From the Settings Document                  | Accepted   | 2026-07-31 |
| [0066](0066-a-report-names-the-directive-it-answers.md)                     | A Report Names the Directive It Answers                                             | Accepted   | 2026-08-01 |
| [0067](0067-paperwork-events-run-in-their-own-lane.md)                      | Title and Label Events Run in Their Own Concurrency Lane                            | Accepted   | 2026-08-01 |
| [0068](0068-the-standing-sidebar-carries-its-own-control.md)                | The Standing Sidebar Carries the Control That Puts It Away                          | Accepted   | 2026-08-01 |
| [0069](0069-subscriptions-delegate-to-the-providers-tool.md)                | Subscriptions Delegate to the Provider's Tool, and Custody Follows Each Platform    | Accepted   | 2026-08-02 |
| [0070](0070-key-checks-live-in-the-engine-child.md)                         | Key Checks Live in the Engine Child                                                 | Accepted   | 2026-08-03 |
| [0071](0071-tanstack-form-carries-the-renderer-drafts.md)                   | TanStack Form Carries the Renderer Drafts                                           | Accepted   | 2026-08-03 |
