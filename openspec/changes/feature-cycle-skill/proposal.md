# Feature-cycle skill proposal

## Why

The feature-cycle design spec locked a per-feature pipeline, and PR-1 gave it an artifact layer. The process definition itself doesn't exist yet. Nothing tells a session how to run the pipeline, no subagent roster backs its nodes, and the solution-design template is still CLI scaffolding. Rollout item 2 of the spec assigns exactly that work to this change.

## What changes

- A `feature-cycle` skill becomes the single entry point that defines the pipeline: tiers, discovery arms, approval gates, implementation discipline, and the pull request line.
- Five subagent definitions land under `.claude/agents/` with trigger-rule descriptions, skill preloads, read-only tool sets for judges, and project-scoped memory for reviewers. The existing `rules-reviewer` already had a trigger description and a restricted tool set, so it gains only the explicit model pin.
- The `design.md` template in the recompose schema grows from scaffolding into the researched seventeen-section solution-design template.
- `CLAUDE.md` routes feature development through the skill.
- A process Architecture Decision Record (ADR) records the decisions, including the change-hygiene policy this proposal itself follows: every change carries at least one spec delta from creation, because validation demands one.

## Capabilities

### New capabilities

- `development-process`: the behavioral contract of the feature pipeline, from classification to merge.

### Modified capabilities

None.

## Impact

- New feature work gains a defined, gated pipeline with a stable artifact home in `openspec/changes/`.
- Sessions and subagents inherit the process from files instead of conversation memory.
- Existing product code doesn't change. The pipeline first runs live on the provider hookup feature after this change merges.
