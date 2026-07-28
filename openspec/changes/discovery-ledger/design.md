# Discovery-ledger design

## Header and change linkage

- Change id: discovery-ledger
- Schema: recompose
- Proposal: [proposal.md](proposal.md)
- Specs: [specs/development-process/spec.md](specs/development-process/spec.md)
- Discovery: None
- Tasks: [tasks.md](tasks.md)

## Context

The verification phase reference says an out-of-scope discovery lands in a ledger that keeps a fix round scoped. No ledger exists. A session that notices something beyond the change in hand either widens the change or drops the finding, and neither leaves a record.

The gap reaches shipped code. The `feature-kickoff` workflow dispatches an arm for prior out-of-scope findings that touch the feature. That arm reads nothing, because nobody ever built the ledger it names. It also runs on `code-analyzer`, whose job is mapping the source tree.

## Discovery inputs consumed

- `.claude/skills/feature-cycle/references/verification.md`: supplies the ledger's stated purpose, that it keeps a round scoped without losing what the round found.
- `.claude/skills/feature-cycle/references/planning.md`: supplies the arm table and the standard-tier fold, both of which this change has to leave true.
- `.claude/workflows/feature-kickoff.js`: holds the arm this change redirects.
- The repository's issue tracker: consulted and acted on. It already carries this project's open work, which is why the ledger needs no new store.

## Goals and non-goals

**Goals:**

- An out-of-scope discovery has an outlet a later feature's discovery phase can read.
- The discovery workflow's ledger arm reads the ledger rather than the source tree, on both tiers.
- The references describe what the code does.

**Non-goals:**

- No finding-by-commit verifier and no fix-cycle workflow. Both wait until a feature has run through the pipeline, because building them now would design against imagination rather than experience.
- No gate over filing a discovery.
- No schema for a ledger entry beyond the label.

## Constraints and invariants

- Never write code comments.
- Build only what the current requirement needs, in the simplest form that works.
- Commit style `<type>: <imperative subject>`, at most 50 characters. Every commit passes lefthook without bypass.
- `main` stays protected. One job, one branch, one pull request.
- A reference that describes the code has to stay true in the same commit that changes the code.

## Design

The ledger becomes issues on the repository under a single `rider` label. A title names the defect, and a body names where it surfaced and why it fell outside the change in hand. Nothing more needs pinning down. The tracker already gives search, cross-links from a pull request, and a one-command filing.

The `rider-ledger` arm in `feature-kickoff` drops its `code-analyzer` type and runs on the default subagent, whose command access reaches the tracker. Its focus text names the label and asks for the prior findings that touch the feature, with issue numbers.

The `standard` tier folds five lines of enquiry into two arms, and its folded arm asks for prior out-of-scope findings while running on `researcher`, a type with no tracker access. That's the same defect in the tier that runs more often, so it moves too. The fold stays at two arms either way, so the cap arithmetic doesn't change.

## Data model and contracts

None beyond the label. A ledger entry is an issue, and the label is the only contract.

## Error handling

- **The tracker is unreachable, or the label has no issues.** The arm reports that it found no prior findings. An empty ledger is a normal state, not a failure.
- **A dead ledger arm.** The workflow already logs and continues for any arm other than the code map. That's the right behavior here, because a missing brief costs context rather than correctness.

## File map

- `.claude/workflows/feature-kickoff.js`: both tiers' ledger lookups query the tracker (modify).
- `.claude/skills/feature-cycle/references/planning.md`: the arm table and the standard-tier paragraph match the code (modify).
- `.claude/skills/feature-cycle/references/verification.md`: the ledger sentence gains the mechanism (modify).
- `.claude/skills/feature-cycle/SKILL.md`: the rollout note drops the ledger from its deferred list (modify).

## Interfaces

- Consumes: the repository's issue tracker.
- Produces: the `rider` label as the ledger's only contract.

## Decisions

### 1. The ledger lives on the issue tracker

The tracker already carries this project's open work. It searches, it links from a pull request, and a session files an entry with one command. A file in the repository would need its own format, its own review, and its own tooling to stay honest.

**Alternatives considered:** a markdown ledger under `docs/`, rejected because it drifts and needs its own machinery to search. A new store of any other kind, rejected outright.

### 2. Nothing enforces that a discovery gets filed

A gate over filing would reward staying quiet, because the cheapest way past it would be to notice nothing. The ledger earns its use by being the outlet that keeps a round scoped.

**Alternatives considered:** a gate demanding a ledger entry per round, rejected on the incentive it creates.

### 3. The verifier waits for the first real feature

The fix cycle's other missing piece closes a finding only when its verifier confirms the repair against a named commit. Building that now would fix a shape before any feature has produced a round of findings to shape it. The first feature to run through the pipeline says how many findings arrive, how many are wrong, and whether serial repair is worth its cost.

**Alternatives considered:** shipping both pieces together, rejected because the ledger closes a defect in shipped code while the verifier is machinery for a loop nobody has run.

## Test matrix

| Layer          | What this layer proves (or why none)                                                                       | Check command             |
| -------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------- |
| Unit           | None. The change edits one saved workflow's prompt text and three documents. No importable module changes. | none                      |
| Integration    | None, for the same reason. The workflow's hooks exist only inside the harness.                             | `pnpm run test:workflows` |
| End-to-end     | None. Development-pipeline machinery outside the desktop application.                                      | none                      |
| Property       | None. No invariant is at stake.                                                                            | none                      |
| Mutation scope | None. The Stryker gate scopes to `apps/` and `packages/`.                                                  | `pnpm run test:mutation`  |

The workflow suite still runs, because the change must not break the 98 cases already covering the other workflows.

## Task decomposition hooks

- Task 1: The label and both tiers' ledger arms (depends on: none, hands off: the label name).
- Task 2: The references and the rollout note (depends on: Task 1).
- Task 3: The pull request (depends on: Tasks 1 and 2).

## Risks

- [Risk] This checkout documents no tool grants for the default subagent, so the arm may lack tracker access at run time → Mitigation: the arm reports that it found nothing and the run continues, and the first pipeline run settles it.
- [Risk] The ledger fills with entries nobody reads → Mitigation: the discovery arm reads it on every feature, which is the only consumer this design needs.
- [Risk] Dropping the `researcher` pin from the standard tier's folded arm loses that persona's discipline → Mitigation: recorded in the task report as a trade, with the focus text carrying the discipline the pin used to.

## Migration and rollout

None. The label is new, the arm edits are in place, and the reference edits describe what the code does. Rolling back means reverting one workflow and three documents.

## Open questions

None.

## End-to-end verification

A run of `feature-kickoff` on a slug returns a ledger brief naming issue numbers, or reporting that the ledger holds nothing that touches the feature. The workflow suite stays at 98 passing.

A fresh-context reviewer diffs the result against these criteria:

- Neither tier's ledger lookup runs on a subagent without tracker access.
- The arm count and the cap arithmetic stay as they were.
- `planning.md`'s arm table and its standard-tier paragraph match the code.
- `verification.md` names the label and says nothing gates the filing.
- The rollout note still defers the verifier, and no longer defers the ledger.
