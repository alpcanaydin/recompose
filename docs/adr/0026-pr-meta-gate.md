# 0026: A meta-gate machine-checks pull requests for tests and decision records

**Status**: Accepted
**Date**: 2026-07-24

## Context

Two process rules lived only in prose. The Test-Driven Development (TDD) invariant says test code changes exactly when behavior changes. The architecture rule says every significant technical decision lands with an Architecture Decision Record (ADR). Nothing failed a Pull Request (PR) that broke either one. The maintainer shaped the design in a brainstorm, starting from a real worry. Behavior-focused specs mean a pure refactor changes no tests, and refactors happen often. A naive "source changed, tests didn't" check would punish exactly the discipline the rules demand.

## Decision

- **The TDD check is type-aware.** The PR title is already commitlint-enforced Conventional Commits, so the type is a machine-checked signal. `feat`, `fix`, and `perf` titles must carry a test diff when they touch source. `refactor`, `docs`, `chore`, `ci`, `build`, `style`, and `test` titles are exempt, which encourages the other half of the rule: a pure refactor never needs to touch a spec.
- **Type exemption isn't an honor system.** The `codecov/patch` check stays the abuse net: a "refactor" that actually adds behavior produces changed lines that existing tests don't cover, and the coverage gate fails it.
- **The escape hatch is loud and audited.** A legitimate `feat` with no testable surface takes the `tdd-exempt` label plus a `TDD-exempt: <reason>` line in the PR body. The label alone isn't enough. The weekly audit workflow now lists every merged PR that used an exemption label, the same visibility the ruleset bypass audit has.
- **The ADR check watches architecture-significant paths**: workflow files, root configuration (turbo, tsconfig, oxlint, lefthook, dependency-cruiser, knip, codecov, Vale, jscpd, mise, workspace, steiger), and the birth of a new package or app. Changing them without a `docs/adr/` change fails, which machine-encodes the rule that no gate loses strength without a record. The escape is symmetric: `adr-exempt` label plus an `ADR-exempt: <reason>` body line, audited weekly.
- **Implementation is one plain job** (`meta`) using the GitHub CLI against the PR files, title, labels, and body: no framework. The workflow now also listens to `labeled` and `unlabeled` events so toggling an exemption re-evaluates the gate automatically; other jobs rerun too, which the caches keep cheap. The job joins the `ci-success` needs list per ADR-0007.
- **Mutation testing is the recorded future layer.** Coverage proves execution, not assertion strength. The Stryker mutation framework arrives with the engine as a diff-scoped PR run plus a scheduled full run, per the industry guidance against putting it in the delivery pipeline.
- **No lefthook leg, recorded deviation**: both checks judge PR-level artifacts (title, labels, body, file list against a base), which don't exist at commit time. The same reasoning as the Codecov gate applies (ADR-0022).

## Alternatives

- **Danger.js**: the canonical tool for exactly these rules, and its own docs recommend warning rather than failing for the source-without-tests case. Rejected as a framework plus dependency for two greps; the queue's own ground rule says the lightest tool wins.
- **A label-only escape with no justification line**: weaker audit trail for zero saved effort.
- **Enforcing the inverse too** (failing a `refactor` that touches tests): rejected because moves and renames legitimately update import paths inside specs.

## Consequences

- A `feat` or `fix` PR that touches source without touching a spec fails with a message that names the rule and the escape hatch. A refactor sails through untouched, and patch coverage checks its honesty instead.
- Gate configuration and workflow changes now force either a decision record or a loud, audited exemption. The gate this ADR ships would have demanded this exact record.
- Exemption labels are repository-level artifacts, and the weekly audit issue makes their usage pattern reviewable over time.
- Toggling labels triggers a full CI rerun. Exemptions are rare by design, so the cost stays negligible.
