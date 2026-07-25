# 0032: Renovate pin bumps take the adr-exempt escape hatch automatically

**Status**: Accepted
**Date**: 2026-07-25

## Context

The meta gate from Architecture Decision Record (ADR) 0026 fails any pull request (PR) that changes an architecture-significant path without a `docs/adr/` change. Workflow files and `mise.toml` sit on that trigger list, and Renovate's whole job is changing them: it bumps pinned action digests in `.github/workflows/` and tool versions in `mise.toml`. The first such bump, `github/codeql-action` v4.36.3 to v4.37.1, failed the gate and stalled its own automerge. A pin bump re-executes a decision an earlier record already made. ADR-0028 adopted CodeQL, and keeping pins fresh through Renovate is the recorded practice, so the gate demanded a record that has no decision to hold.

## Decision

`renovate.json` gains one `packageRules` entry scoped with `matchFileNames` to the trigger paths Renovate manages: `.github/workflows/**` and `mise.toml`. A matching PR receives the `adr-exempt` label through `addLabels` and the required `ADR-exempt: <reason>` body line through `prBodyNotes`. The bot takes the same loud escape hatch ADR-0026 designed for humans. The gate's logic doesn't change, and the weekly exemption audit lists every bump it waves through. Renovate configuration only shapes Renovate's own PRs, so the exemption can't leak to a human PR that edits a workflow.

Renovate applies labels when it creates a PR, so the one bump opened before this rule takes the escape hatch by hand.

## Alternatives

- **Skipping the ADR check for the bot author inside the gate**: a second, silent bypass beside the designed one. The audit trail disappears, and the author signal is weaker than it looks because anyone can push commits onto a Renovate branch.
- **A top-level label on every Renovate PR**: most Renovate PRs never touch a trigger path, so the weekly audit would fill with rows that carry no information.
- **Labeling each bump by hand**: automerge exists so pin bumps land without a human, and a manual step per bump defeats it.

## Consequences

**Good**: pin-bump PRs pass the meta gate and automerge again. The exemption stays visible, because the weekly audit issue names every bot bump, which keeps the usage pattern reviewable exactly as ADR-0026 intended.

**Bad**: human exemptions now share the weekly audit list with routine bot rows. The trigger-path list also lives in two places, the gate's pattern and this rule's `matchFileNames`, and nothing machine-checks that pairing. A path added to the gate without a matching entry here stalls the next bot bump on that path.
