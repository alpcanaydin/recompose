# recompose — Project Rules

## Before starting any work

- Research current industry best practices for the topic (web search), independent of this codebase.
- If a clear standard path exists, bring the codebase into conformance with it first, then do the work.

## Skills

- Use the `ponytail` skill for everything — every task starts by invoking it.
- Every session starts by invoking `karpathy-guidelines` — before any other work.

## Comments

- **Never write code comments.** Code must explain itself through naming and structure.
- The only exception: a constraint or invariant that code genuinely cannot express (e.g. "Electron requires this before app.ready"). If in doubt, don't write it.

## Architecture decisions

- Every technical decision is recorded as an ADR under `docs/adr/`, written via the `architecture-decision-records` skill. No undocumented decisions.

## README

- Whenever README.md is created or updated, use the `create-readme` skill.

## Commits

- Every commit goes through the `caveman-commit` skill. No exceptions.

## Feature development

- Every feature is developed through the `superpowers` workflow (`using-superpowers` entry point): brainstorm → plan → TDD implementation → verification.
- Trivial work (config tweaks, docs, single-file fixes) skips the full cycle — just do it. The workflow is for features.

## TDD/BDD

- Follow @.claude/rules/tdd-bdd.md — inside-out (Detroit/classicist) TDD with BDD-style behavior specs. Test code changes if and only if behavior changes.

## Testing

- Write tests at every layer of the test pyramid: unit, integration, e2e.
- Unit & integration tests: use the `javascript-testing-patterns` skill.
- E2E tests: use the `e2e-testing-patterns` skill.

## Clean code

- Follow @.claude/rules/clean-code.md — intent-revealing names, single responsibility, KISS/YAGNI/DRY-for-knowledge, no silent failures.

## Design system

- Before any UI/UX design decision, search the Mobbin MCP for similar-concept designs and use them as reference.
- The design system is built with Tailwind; its source of truth is the Claude Design project **"recompose-design-system"**.
- Use the `design-system-patterns` skill for design-system architecture (tokens, variants, component structure).
- Use the `tailwind-design-system` skill for the Tailwind implementation.

## Frontend (renderer) — Vercel skills

- `vercel-react-best-practices` — before writing or reviewing ANY React code in the renderer.
- `vercel-composition-patterns` — when designing component APIs or structuring components (canvas nodes, inspector, drawers): composition over prop drilling.
- `vercel-react-view-transitions` — when implementing UI transitions/animations between views or states (screen switches, drawer open/close, node focus).
- `writing-guidelines` — when writing any user-facing copy, docs, or README text.

## Long-form writing

- `writing-fragments` — explore: mine raw fragments by interviewing the user before any structure exists (blog posts, announcements, essays).
- `writing-shape` — exploit: shape an existing raw-material file into a finished article, paragraph by paragraph. Explore first, then shape.

## TypeScript

- Maximum strictness, always: `strict: true` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`.
- No `any`, no `as` casts to silence errors, no `@ts-ignore`/`@ts-expect-error` without a comment explaining why.
