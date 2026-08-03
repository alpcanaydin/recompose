# 0071: TanStack Form carries the renderer drafts

**Status**: Accepted
**Date**: 2026-08-03

## Context

The renderer holds two drafts a person fills before recompose stores anything: the gateway create sheet and the key connect form. Each carried its own hand-rolled state, one as a bespoke hook folding refusal maps over `useState`, one as bare `useState` pairs. Every future surface with fields would grow a third dialect of the same machinery. The stack already standardizes on TanStack for routing and server state. TanStack Form is the same family's form layer: headless, type-safe from default values to submit, and validated per field. Plain functions or the zod schemas of `@recompose/contracts` drive the validators.

## Decision

**Every renderer draft runs on `@tanstack/react-form`.** One `useForm` per draft. The design system's own rows render the fields through `form.Field`, so the library never reaches the screen. Submit acts read the mutation's own pending flag, and value-driven gates read the store through `useSelector`.

**Validators speak on submit and recompute on change.** Field rules key to `onChange`, and the surface shows them only after the first submit attempt, read from `submissionAttempts`. TanStack runs change validators at submit time by its own default validation logic. A first save therefore reveals every standing refusal, and typing afterward clears or updates it live. Rules keyed to `onSubmit` alone would stick until the next save, which contradicts the standing behavior that a refusal clears once the person changes the field it concerns.

**Refusals the main process answers stay beside the form, not inside it.** A conflict names the field it concerns and clears when that field changes, and a draft-wide refusal keeps its own alert line. The form owns what the person typed, and the transport owns what the machine refused.

## Consequences

**Good**: one form dialect across the renderer, typed values end to end, and per-field validation that the contracts' zod schemas can drive directly. The gateway migration changed no test, which is the refactor's own proof.

**Bad**: a second reactive store lives beside TanStack Query, and the submit-gated validator pattern is a house convention the library doesn't enforce, so the `tanstack-form` skill records it. A refusal that stays refused while a person retypes now keeps speaking until the value stands, where the old machinery went silent until the next save. That corner has no covering scenario and reads as guidance rather than noise.

## Alternatives

**Keep the bespoke hooks.** Rejected: two dialects already drifted, and each new draft would mint a third.

**React Hook Form.** Rejected: register-based field wiring fights controlled design-system rows, and the stack's vocabulary is already TanStack's.

**Native form validation.** Rejected: the browser's bubbles speak the platform's words, not the design's, and macOS sheets never show them.
