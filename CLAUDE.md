# recompose project rules

## Before starting any work

- Research current industry best practices for the topic (web search), independent of this codebase.
- If a clear standard path exists, bring the codebase into conformance with it first, then do the work.
- When a request sounds like a capability of a platform or tool already in use (GitHub, Electron, pnpm, and so on), search for the built-in or off-the-shelf solution first. Write a custom implementation only after that search comes up empty.

## Git workflow

- `main` stays protected. Never commit to it, locally or remotely.
- Every job (feature, fix, docs, config, skills) gets its own worktree and branch, and lands through a PR. One job = one branch.

## CodeRabbit reviews

- Before acting on a finding, compare it with official docs and the actual code, and never apply it without checking first.
- Addressed a finding → reply on its thread naming the fixing commit, then resolve the thread immediately.
- Rejecting or deferring a finding → reply with the reasoning and leave the thread unresolved so CodeRabbit can respond; resolve only when the exchange settles.
- No conversation stays unresolved at the end of the day: when CodeRabbit acknowledges an exchange but leaves the thread open, resolve it yourself.

## Skills

- Use the `ponytail` skill for everything, since every task starts by invoking it.
- Every session starts by invoking `karpathy-guidelines` before any other work.

## Prose style

- **Never use an em dash.** Don't patch one out with a colon: rewrite the sentence so it reads as if it never had one.
- All authored markdown passes Vale: Microsoft base style with rules promoted to error, plus the house rules in `.vale/styles/recompose/` (`docs/adr/0025-vale-prose-gate.md`). New vocabulary lands in the committed accept list through the PR diff.

## Comments

- **Never write code comments.** Code must explain itself through naming and structure.
- The only exception: a constraint or invariant that code genuinely can't express (for example, "Electron requires this before app.ready"). If in doubt, don't write it.

## Architecture decisions

- Every technical decision becomes an Architecture Decision Record (ADR) under `docs/adr/`, written via the `architecture-decision-records` skill. No undocumented decisions.

## `README.md`

- Whenever README.md needs creating or updating, use the `create-readme` skill.

## Commits

- Every commit goes through the `caveman-commit` skill. No exceptions.

## Feature development

- Every feature goes through the `superpowers` workflow (`using-superpowers` entry point): brainstorm → plan → Test-Driven Development (TDD) implementation → verification.
- Trivial work (config tweaks, docs, single-file fixes) skips the full cycle. Just do it. The workflow is for features.

## Test-driven and behavior-driven development

- Follow @.claude/rules/tdd-bdd.md, which lays out inside-out (Detroit/classicist) TDD with Behavior-Driven Development (BDD)-style behavior specs. Test code changes if and only if behavior changes.

## Testing

- Write tests at every layer of the test pyramid: unit, integration, e2e.
- Unit & integration tests: use the `javascript-testing-patterns` skill.
- Load-bearing derived types (mapped types, schema-inferred types) get type-level specs: `*.test-d.ts` with `expectTypeOf`, run through vitest typecheck. The TDD invariant applies at the type level: a type contract changes if and only if its type spec changes.
- Vitest work (writing tests, config, mocking, coverage): use the `vitest` skill.
- Property-based testing (fast-check): use the `javascript-testing-expert` skill.
- E2E tests: use the `e2e-testing-patterns` skill.

## Clean Code

- Follow @.claude/rules/clean-code.md: intent-revealing names, single responsibility, no silent failures. It favors Keep It Simple, Stupid (KISS), You Aren't Gonna Need It (YAGNI), and Don't Repeat Yourself (DRY) for knowledge.

## Design system

- Before any UI/UX design decision, search Mobbin through the Model Context Protocol (MCP) for similar-concept designs and use them as reference.
- Tailwind builds the design system; its source of truth is the Claude Design project **"recompose-design-system."**
- Use the `design-system-patterns` skill for design-system architecture (tokens, variants, component structure).
- Use the `tailwind-design-system` skill for the Tailwind implementation.

## Frontend (renderer) skills

- Use the `feature-sliced-design` skill before creating or moving any file in the renderer. Its decision tree determines the file's layer, slice, and segment placement under Feature-Sliced Design (FSD) v2.1 (see ADR-0010).
- Use the `tanstack-router` skill before any TanStack Router work (routes, navigation, search params) for file-based conventions, loader discipline, and type registration. Use `tanstack-devtools` when wiring devtools.
- Use the `tanstack-query` skill before any TanStack Query work (query options, loaders warming caches, mutations/invalidation). Its conventions apply.
- Use the `vercel-react-best-practices` skill before writing or reviewing any React code in the renderer.
- Use the `vercel-composition-patterns` skill when designing component APIs or structuring components (canvas nodes, inspector, drawers), favoring composition over prop drilling.
- Use the `vercel-react-view-transitions` skill when implementing UI transitions/animations between views or states (screen switches, drawer open/close, node focus).
- Use the `writing-guidelines` skill when writing any user-facing copy, docs, or README text.

## Long-form writing

- Use the `writing-fragments` skill to explore: gather raw fragments by interviewing the user before any structure exists (blog posts, announcements, essays).
- Use the `writing-shape` skill to exploit: shape an existing raw-material file into a finished article, paragraph by paragraph. Explore first, then shape.

## TypeScript

- Maximum strictness, always: `strict: true` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`.
- No `any`, no `as` casts to silence errors, no `@ts-ignore`/`@ts-expect-error` without a comment explaining why.
