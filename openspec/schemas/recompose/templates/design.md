# Solution Design

<!-- One per feature change. Fill every always-on section; a when-applicable section may collapse to None on the standard tier. -->

## Header and change linkage

<!-- Anchor the artifact chain so a fresh-context reader navigates it without guessing. -->

Record the change id and schema, then link every sibling artifact for this change.

- Change id: <change id>
- Schema: recompose
- Proposal: <link>
- Specs: <link>
- Discovery: <link>
- Tasks: <link>

## Context

<!-- Frame the problem so this document stands alone; do not restate the proposal's motivation. -->

State the problem this design solves and the situation it lands in, enough for a reader who has not opened the proposal to follow every section below.

## Discovery inputs consumed

<!-- Show which discovery outputs shaped the design and what each one changed here. -->

List each code-map entry, research finding, and rider hit that shaped this design, with the one thing it changed. List any input consulted but not acted on as "consulted, no impact."

- <input>: <what it changed in this design, or "consulted, no impact">

## Goals and non-goals

<!-- Fence the scope; non-goals are the cheapest defense against overscope and underspecification. -->

**Goals:**

- <a goal this design must achieve>

**Non-goals:**

- <what this design deliberately excludes (treat each as a hard scope fence)>

## Constraints and invariants

<!-- Restate the project rules that bind this feature, verbatim, so no downstream task relaxes them. -->

Restate every binding rule verbatim: TypeScript strictness settings, Feature-Sliced Design boundaries, the no-comments rule, and any other constraint this feature must hold.

## Design

<!-- Give the approach: overview before detail, trade-offs in view; add a sequence or flow diagram when interaction order matters. -->

Describe the approach: overview first, then the detail. Foreground the trade-offs behind the shape you chose. Add a sequence or flow diagram when interaction order carries the design.

## Data model and contracts

<!-- Pin the entities, state transitions, and channel or storage contracts the feature touches. -->

When applicable, the standard tier may write None. Define entities, state transitions, IPC channel schemas, and storage contracts.

## Error handling

<!-- Enumerate the expected failure states as typed results and how each one routes or surfaces. -->

When applicable, the standard tier may write None. List each expected failure state as a typed result and state how it routes or surfaces.

## File map

<!-- Name every path created or modified with its one-line responsibility and FSD placement. -->

List each create/modify path with a one-line responsibility, matching Feature-Sliced Design placement.

- `<path>`: <responsibility> (create | modify)

## Interfaces

<!-- Give the exact exported signatures at each boundary so a task-scoped implementer learns the names its neighbors use. -->

For each boundary, give the exact exported signatures and types in consumes/produces form.

- Consumes: <signatures and types this feature depends on>
- Produces: <signatures and types this feature exposes>

## Decisions

<!-- Record each choice with its rationale and alternatives; link an ADR draft for any decision that meets the ADR bar. -->

One numbered block per choice.

### 1. <decision name>

<the choice, and why it wins over the alternatives>

**Alternatives considered:** <alternative, rejected because ...>

**ADR draft:** <link (when the decision meets the ADR bar)>

## Test matrix

<!-- Map behaviors to the five test layers; every row proves something or states why none, and names its check command. -->

Fill every row. A row states what its layer proves, or gives the reason none applies.

| Layer          | What this layer proves (or why none)           | Check command |
| -------------- | ---------------------------------------------- | ------------- |
| Unit           | <behavior proved, or reason none>              | <command>     |
| Integration    | <behavior proved, or reason none>              | <command>     |
| End-to-end     | <behavior proved, or reason none>              | <command>     |
| Property       | <behavior proved, or reason none>              | <command>     |
| Mutation scope | <what mutation testing covers, or reason none> | <command>     |

## Task decomposition hooks

<!-- Mark the task boundaries, their dependency order, and the interface handoff each one gives the next, so tasks.md derives mechanically. -->

Name the intended tasks, their dependency order, and the interface each task hands off, so tasks.md follows without reinterpretation.

- Task <n>: <name> (depends on: <task or none>, hands off: <interface>)

## Risks

<!-- Surface what could go wrong, each paired with its mitigation. -->

One line per risk: [Risk] <what could go wrong> → Mitigation: <how it is contained>.

## Migration and rollout

<!-- State how the change deploys, rolls back, and migrates data; write None rather than omitting. -->

When applicable, the standard tier may write None. Cover deploy, rollback, and data migration.

## Open questions

<!-- Hold only unknowns answerable later without changing specs, approach, or tasks; an empty section asserts the design is complete. -->

List only unknowns that can be answered later without changing the specs, the approach, or the tasks. Leave this empty to assert the design is complete; anything heavier resolves before tasks are cut.

## End-to-end verification

<!-- Give the final observable check in the running app, plus the criteria a fresh-context reviewer diffs against. -->

State the final observable check that proves the feature works in the running app, then the review criteria a fresh-context reviewer diffs the result against.
