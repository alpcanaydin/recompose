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

The gap reaches shipped code. The `feature-kickoff` workflow dispatches an arm for prior out-of-scope findings that touch the feature. That arm reads nothing, because nobody ever built the ledger it names, and its prompt never says where a ledger would live. Given only the phrase, the subagent searches the source tree.

## Discovery inputs consumed

- `.claude/skills/feature-cycle/references/verification.md`: supplies the ledger's stated purpose, that it keeps a round scoped without losing what the round found.
- `.claude/skills/feature-cycle/references/planning.md`: supplies the arm table and the standard-tier fold, both of which this change has to leave true.
- `.claude/workflows/feature-kickoff.js`: holds the arm this change redirects.
- The repository's issue tracker: consulted and acted on. It already carries this project's open work, which is why the ledger needs no new store.

## Goals and non-goals

**Goals:**

- An out-of-scope discovery has an outlet a later feature's discovery phase can read.
- The discovery workflow's ledger arm reads the ledger rather than the source tree.
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

The ledger becomes issues on the repository under a single `rider` label. A title names the defect, and a body names where it surfaced and why it fell outside the change in hand. Those two fields are the contract, because a reader judges relevance from the body rather than from the label. Nothing beyond them needs pinning down: the tracker already gives search, cross-links from a pull request, and a one-command filing.

The two tiers need different fixes, because their subagents differ in what they can reach. `code-analyzer` carries a command tool, and `researcher` carries none.

On the `full` tier the arm keeps `code-analyzer`, which could always have queried the tracker. Its focus text gains the label and the command, so the subagent has nothing to interpret. The command asks for the issue number, the title, and the body. It also raises the result limit past the default of thirty, which would otherwise hide older entries as the ledger grows. The subagent type was never the fault.

On the `standard` tier the fold gives one `researcher` the research, the acceptance criteria, and the ledger lookup. That subagent has no command access, so the ledger clause leaves its focus text and the tier stops looking at the ledger. The planning reference states that loss and its reason, because an undocumented capability loss is the failure this project keeps paying for. Both tiers keep their arm counts, so the cap arithmetic doesn't change.

## Data model and contracts

A ledger entry is an open issue carrying the `rider` label. Its title names the defect. Its body names where the discovery surfaced and why it fell outside the change in hand. The reading arm requests the issue number, the title, and the body, because a title alone seldom says whether an entry touches the feature in hand.

## Error handling

- **The label has no issues.** The arm reports that it found no prior findings. An empty ledger is a normal state rather than a failure.
- **The tracker is unreachable.** The arm reports the lookup as failed, and never as an empty ledger. An outage that reads as "nothing found" would let a reader conclude no prior finding exists, which is the false-reason failure this project keeps paying for.
- **A dead ledger arm.** The workflow already logs and continues for any arm other than the code map. That's the right behavior here, because a missing brief costs context rather than correctness.

## File map

- `.claude/workflows/feature-kickoff.js`: the full tier's ledger arm names the label and the command, and the standard tier's folded arm drops the ledger clause (modify).
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

- [Risk] The standard tier no longer consults the ledger, so that tier can rediscover a prior finding → Mitigation: the planning reference states the loss and its reason, and a tier upgrade restores the lookup.
- [Risk] The ledger fills with entries nobody reads → Mitigation: the discovery arm reads it on every feature, which is the only consumer this design needs.
- [Risk] A later contributor reads the full tier's arm and assumes any subagent can reach the tracker → Mitigation: the focus text names the command, so the requirement is visible at the point of use.

## Migration and rollout

None. The label is new, the arm edits are in place, and the reference edits describe what the code does. Rolling back means reverting one workflow and three documents.

## Open questions

None.

## End-to-end verification

A run of `feature-kickoff` on a slug returns a ledger brief naming issue numbers, or reporting that the ledger holds nothing that touches the feature. The workflow suite stays at 98 passing.

A fresh-context reviewer diffs the result against these criteria:

- The full tier's ledger arm keeps `code-analyzer` and names both the label and the command.
- The standard tier's folded arm keeps `researcher` and no longer claims a ledger lookup.
- The arm count and the cap arithmetic stay as they were.
- `planning.md`'s arm table and its standard-tier paragraph match the code.
- `verification.md` names the label and says nothing gates the filing.
- The rollout note still defers the verifier, and no longer defers the ledger.
