# 0038: The feature cycle as an executable process

**Status**: Accepted
**Date**: 2026-07-26

## Context

This Architecture Decision Record (ADR) follows ADR-0037, which gave the feature cycle its artifact layer. OpenSpec now stores each change under `openspec/changes/<slug>/`, and the validate gate guards the tree. That record stopped at storage. It left the process that fills those directories undefined.

A session still learned the pipeline from conversation memory. No subagent roster backed its phases, and the solution-design template held Command-Line Interface (CLI) scaffolding. This record closes that gap. The behavioral contract lives in the `development-process` capability under `openspec/specs/`, and this record captures the decisions behind the files that carry it.

## Decision

recompose defines the feature cycle as a skill. A subagent roster, a solution-design template, and a change-hygiene policy support it.

- **The skill is the process document.** `.claude/skills/feature-cycle/SKILL.md` holds the entry contract, the tier rubric, and the change-hygiene rule. One `references/` file per phase carries the planning, implementation, and verification detail, so the main file stays scannable. The skills tree skips the prose gate, so the skill quotes gate output and rubric tables in place.
- **`CLAUDE.md` routes every feature to the skill.** The feature-development section points at `/feature-cycle <description>`. Trivial work keeps its escape hatch. Superpowers drops to the executor library that the skill calls during implementation.
- **The subagent roster follows one convention.** Six definitions under `.claude/agents/` share a shape. Each carries a trigger-rule `description` that states when the subagent fires, an explicit `model` pin, and `skills:` preloads in place of duplicated instructions. Judges take a read-only `tools` list, reviewers take `memory: project`, and the implementer takes `isolation: worktree`. The subagent configuration documents the `skills`, `memory`, and `isolation` keys as supported fields. One caveat holds: the loader skips `memory` with no warning when the harness disables project memory.
- **The seventeen-section solution-design template replaces the scaffold.** It lands at `openspec/schemas/recompose/templates/design.md`. Always-on sections stand apart from when-applicable ones, so the standard tier trims without loss. Two fill rules hold. A test-matrix row states what its layer proves or gives a reason for none. An empty open-questions section asserts completeness.
- **Change hygiene means real deltas and no `skip_specs`.** Every change carries at least one spec delta with a scenario from its first commit, because the validate gate fails a change that holds none. Meta changes write their deltas into `development-process`. The `skip_specs` flag acts at archive time alone. It never bypasses validation, and it skips the fold of deltas into `openspec/specs/` at archive. This change once carried `skip_specs: true` next to real deltas. That pairing would have discarded the `development-process` contract at archive. A later commit removed the flag. The policy holds real deltas and no `skip_specs`.
- **A surgical Vale section unblocks the delta trees.** `Microsoft.Acronyms`, `Microsoft.HeadingAcronyms`, and `Microsoft.Headings` switch off under `openspec/changes/**/specs/**` and `openspec/specs/**` alone. The OpenSpec validator mandates capitalized `SHALL` and `MUST` keywords and `## ADDED Requirements` headings. Those three rules reject both. The narrow scope keeps the full prose gate on every other document.
- **Two planning documents split by gate.** The gate-1 design persists as a revision of `proposal.md` in the change directory. It carries the locked decisions and the design-system gap analysis. The schema pins only the gate-2 solution design to its `design` template.

## Alternatives

- **A conversation-driven process**: rejected. Memory drifts between sessions, and no gate can check it. A skill file gives one authoritative source that the prose and validate gates guard.
- **The scaffold design template**: rejected. CLI scaffolding gives a fresh design no structure and no fill discipline. The seventeen-section template makes every solution design comparable.
- **One shared subagent style without pins**: rejected. A model-diverse reviewer pair and read-only judges need explicit `model` and `tools` keys. A single default erases that control.
- **`skip_specs: true` at change creation**: rejected. It discards deltas at archive and buys nothing at validation. Real deltas from the first commit keep the gate green instead.
- **A blanket Vale exemption for the OpenSpec trees**: rejected. ADR-0037 lints `openspec/specs/**` and the human documents on purpose. Only three rules conflict with the validator, so only three switch off.

## Consequences

**Good**: sessions inherit the pipeline from files, not from conversation memory. The roster gives each phase a named subagent with a fixed model and tool set. The template makes every solution design comparable and trims to its always-on sections on the standard tier. Change hygiene keeps the validate gate green on every commit.

**Bad, and accepted**: the skill restates process knowledge that drifts as the pipeline evolves. The planned instruction-drift audit owns that risk in a later change. Linted subagent files add writing friction, accepted once because the definitions stay stable. The template adds weight on small features, which the standard tier trims. Policy bans the `skip_specs` flag, and nothing machine-checks the ban.

**The pipeline first runs live on the next feature**: this change defines the process but ships no product code. The provider hookup feature runs the full cycle first. It becomes the proof that the skill, the roster, and the template hold up under real work.
