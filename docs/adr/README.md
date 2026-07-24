# Architecture decision records

This index records every technical decision in recompose (see `CLAUDE.md`). For a new decision record: copy the lightweight format of an existing one, number it sequentially, and add a row below. Never edit an accepted decision record: supersede it with a new one and update its status.

## Index

| Record                                                         | Title                                                                   | Status   | Date       |
| -------------------------------------------------------------- | ----------------------------------------------------------------------- | -------- | ---------- |
| [0001](0001-electron-as-desktop-shell.md)                      | Electron as Desktop Shell                                               | Accepted | 2026-07-21 |
| [0002](0002-engine-in-electron-utilityprocess.md)              | Gateway Engine Runs in Electron's utilityProcess                        | Accepted | 2026-07-21 |
| [0003](0003-scaffold-with-electron-vite.md)                    | Scaffold with electron-vite                                             | Accepted | 2026-07-21 |
| [0004](0004-pnpm-workspaces-turborepo.md)                      | pnpm Workspaces + Turborepo                                             | Accepted | 2026-07-21 |
| [0005](0005-single-port-path-per-gateway.md)                   | Single Port, Path per Gateway, Both Dialects Always                     | Accepted | 2026-07-21 |
| [0006](0006-local-quality-gate-layer.md)                       | Local Quality Gate Layer                                                | Accepted | 2026-07-21 |
| [0007](0007-ci-layer.md)                                       | CI Layer                                                                | Accepted | 2026-07-22 |
| [0008](0008-liquid-glass-window-chrome.md)                     | Liquid Glass Window Chrome via electron-liquid-glass                    | Accepted | 2026-07-22 |
| [0009](0009-two-tier-design-tokens.md)                         | Two-Tier Design Tokens on Tailwind v4                                   | Accepted | 2026-07-22 |
| [0010](0010-folder-structure-fsd-and-enforced-boundaries.md)   | Folder Structure, Feature-Sliced Renderer, Enforced Boundaries          | Accepted | 2026-07-22 |
| [0011](0011-repo-guards-forbidden-alias-and-protected-main.md) | Repo Guards: Forbidden Owner Alias, Locally Protected Main              | Accepted | 2026-07-22 |
| [0012](0012-vitest-testing-foundation.md)                      | Vitest Testing Foundation with Browser Mode and Property Testing        | Accepted | 2026-07-23 |
| [0013](0013-coderabbit-required-status-check.md)               | CodeRabbit Review as Required Status Check                              | Accepted | 2026-07-23 |
| [0014](0014-dependency-boundaries-enforcement.md)              | Dependency Boundaries Enforced by dependency-cruiser and Steiger        | Accepted | 2026-07-23 |
| [0015](0015-repo-hardening-layer.md)                           | Repo Hardening Layer                                                    | Accepted | 2026-07-23 |
| [0016](0016-storage-architecture.md)                           | Storage, JSON Configs, safeStorage Vault, node:sqlite Usage Log         | Accepted | 2026-07-23 |
| [0017](0017-tanstack-router-file-based-in-app-layer.md)        | TanStack Router, File-Based, Inside the Feature-Sliced App Layer        | Accepted | 2026-07-23 |
| [0018](0018-typed-ipc-with-result-envelope.md)                 | Typed Main-Renderer Channels, Contracts-Defined, with a Result Envelope | Accepted | 2026-07-23 |
| [0019](0019-vercel-remote-cache-for-turbo.md)                  | Vercel Remote Cache for Turborepo                                       | Accepted | 2026-07-23 |
| [0020](0020-jscpd-duplicate-code-gate.md)                      | jscpd Duplicate-Code Gate at Zero Threshold                             | Accepted | 2026-07-23 |
| [0021](0021-cyclomatic-complexity-ceiling.md)                  | Cyclomatic Complexity Ceiling of 5 via oxlint                           | Accepted | 2026-07-23 |
| [0022](0022-codecov-patch-coverage-gate.md)                    | Patch Coverage Gate via Codecov                                         | Accepted | 2026-07-23 |
| [0023](0023-type-level-tests.md)                               | Type-Level Tests for Load-Bearing Derived Types                         | Accepted | 2026-07-24 |
| [0024](0024-type-aware-unsafe-lint.md)                         | Full Type-Aware Lint, Config-Driven                                     | Accepted | 2026-07-24 |
| [0025](0025-vale-prose-gate.md)                                | Vale Prose Gate with Microsoft Style at Full Strength                   | Accepted | 2026-07-24 |
| [0026](0026-pr-meta-gate.md)                                   | A Meta-Gate Machine-Checks Pull Requests for Tests and Records          | Accepted | 2026-07-24 |
