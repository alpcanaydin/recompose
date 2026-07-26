# Feature-cycle skill design

## Context

The pipeline's full design lives in the frozen spec at `docs/superpowers/specs/2026-07-26-feature-cycle-design.md`. The new `development-process` deltas in this change carry its behavioral contract. This document only decides how PR-2 lays that design down as files. The repo already gives it the anchors: a prose-exempt skills tree, a linted `.claude/agents/` directory, and the recompose schema with scaffold templates. `CLAUDE.md` still routes features through the superpowers workflow.

## Goals and non-goals

Goals: a runnable process definition, a complete subagent roster, the researched solution-design template, and the routing update in `CLAUDE.md`. Non-goals: the review workflow (PR-3), the Test-Driven Development (TDD) Guard hook (PR-4), the kickoff workflow script (PR-5), and any product code.

## Decisions

- **The skill is the process document.** `.claude/skills/feature-cycle/SKILL.md` defines entry, tiers, phases, gates, and artifact contracts, with a `references/` file per phase so the main file stays scannable. The skills tree is prose-gate exempt, so the skill can quote gate output and rubric tables.
- **Change hygiene is the skill's first rule.** Creating a change and seeding at least one real spec delta happen in the same commit, because validation fails a change with no deltas. Meta changes write their deltas into `development-process`.
- **Subagent definitions follow one convention.** Trigger-rule descriptions, explicit model pins, `skills:` preloads instead of duplicated instructions, read-only tool sets for judges, project-scoped memory for reviewers, and worktree isolation for the implementer. Five new definitions land, and `rules-reviewer` upgrades to the same convention. These files sit under full prose gates and get written accordingly.
- **The solution-design template replaces the scaffold.** The researched seventeen-section structure lands in `openspec/schemas/recompose/templates/design.md`, with always-on sections separated from when-applicable ones so the standard tier trims cleanly. The template path is prose-gate exempt, which the scaffold collision already forced.
- **`CLAUDE.md` routes features to the skill.** The feature development section points at `/feature-cycle`, keeps the trivial-work escape, and demotes superpowers to the executor library the skill calls.
- **One process Architecture Decision Record (ADR) closes the change.** It records the change-hygiene policy, the archive-only truth about `skipSpecs`, the surgical Vale section for delta trees, and the subagent conventions.

## Risks / Trade-offs

- [Skill drift as the process evolves] → the planned instruction-drift audit owns this later, and the ADR names it.
- [Template weight on small features] → the standard tier trims to the always-on sections, and the template marks them.
- [Linted subagent files add writing friction] → accepted once, because definitions are stable and precision there pays off.
