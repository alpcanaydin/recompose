# Fix-cycle-machinery design

## Header and change linkage

- Change id: fix-cycle-machinery
- Schema: recompose
- Proposal: [proposal.md](proposal.md)
- Specs: [specs/development-process/spec.md](specs/development-process/spec.md)
- Discovery: None
- Tasks: [tasks.md](tasks.md)

## Context

The verification phase reference states two rules that nothing enforces. A finding closes only when its own verifier confirms the repair against the new commit. An out-of-scope discovery lands in a ledger, which keeps the fix cycle scoped. Neither the verifier nor the ledger exists, so a session decides both by judgement and leaves no record.

The gap reaches shipped code. The `feature-kickoff` workflow dispatches an arm for prior out-of-scope findings that touch the feature. That arm has nothing to read, and it runs on `code-analyzer`, whose job is mapping the source tree rather than reading a tracker.

The review pass and the discovery pass both became saved workflows in earlier changes. This change gives the fix cycle the same treatment, and closes the last two entries in the skill's rollout note.

## Discovery inputs consumed

- `.claude/skills/feature-cycle/references/verification.md`: supplies the fix-cycle rules this change implements, including the finding-by-commit key, the serial repair order, and the three-round cap that ends in human triage.
- `.claude/workflows/review-pr.js`: fixes the saved-workflow shape, and its reproduce-or-drop discipline is the shape the verifier copies.
- `.claude/workflows/feature-kickoff.js`: holds the ledger arm this change redirects, and its dispatch-counting assertion is the pattern the round cap follows.
- The repository's issue tracker: consulted and acted on. It already carries this project's open work, which is why the ledger needs no new store.
- The project's rule that a reviewer's finding gets judged against the code before anyone acts on it: it added the judging stage below, which the first sketch of this design lacked.

## Goals and non-goals

**Goals:**

- A finding closes only on its own verifier's confirmation against a named commit.
- An out-of-scope discovery has an outlet that a later feature's discovery phase can read.
- The discovery workflow's ledger arm reads the ledger rather than the source tree.
- One round runs as a workflow, so the repair order and the verification stop depending on the operator.

**Non-goals:**

- No automatic thread resolution and no automatic reply. A reviewer finding gets judged and answered by the session, because a reply is a position this project takes rather than a mechanical acknowledgement.
- No push. The workflow returns the commit it produced and stops, so the maintainer decides what leaves the machine.
- No multi-round loop. Three rounds cap the cycle and the cap ends in human triage, which a workflow can't take.
- No new store for the ledger, and no schema for a ledger entry beyond the label.

## Constraints and invariants

- Never write code comments. The sole exception is a constraint the code genuinely can't express.
- A reviewer's finding gets judged against the documentation and the code first. Nobody acts on one unread.
- Saved workflows take no input once they start, so every human decision sits at a seam between runs.
- Hard-coded subagent caps in every workflow, and a cap that drops work says what it dropped.
- TypeScript at maximum strictness for any script. No `any`, no `as` casts to silence errors.
- Commit style `<type>: <imperative subject>`, at most 50 characters. Every commit passes lefthook without bypass.
- `main` stays protected. One job, one branch, one pull request.

## Design

The change has three parts, and only one of them is code.

**The ledger** becomes issues on the repository under a single `rider` label. The tracker already holds this project's open work, so a discovery needs no new home. It needs no new format either: a title naming the defect, and a body naming where it surfaced and why it fell outside the change in hand. The convention lands in the verification reference. Nothing enforces the filing, because a discovery is a judgement a session makes, and a gate over it would only reward silence.

**The discovery arm** stops reading the source tree. The `rider-ledger` arm in `feature-kickoff` drops its `code-analyzer` type and runs on the default subagent, whose command access lets it query the tracker. The arm's prompt names the label and asks for the prior findings that touch the feature. The planning reference's arm table changes to match, because a reader trusts that table.

**The fix cycle** lands at `.claude/workflows/fix-cycle.js` and runs one round over the open findings on a pull request. It takes the repository slug and the pull request number, reads the unresolved review threads, and runs three stages.

_Judge._ Every finding goes to a judge in parallel, read-only. A judge returns valid or invalid with its reasoning, because this project applies nothing a reviewer says without checking it against the code first. An invalid finding leaves the round with its rejection reasoning attached, for the session to post.

_Repair._ The valid findings go to a repairer one at a time. Serial order isn't a preference here. The repairs share one worktree, and two concurrent repairers would collide. Each repairer commits its own repair, so the round produces a commit chain rather than one lump.

_Verify._ Every repaired finding goes to its own verifier in parallel, against the head the repairs produced. A verifier tries to reproduce the original defect and closes the finding only when it can't. The verdict carries the finding and that commit, which is the finding-by-commit key the rules ask for.

The round returns four lists: closed, survived, rejected, and any finding the cap dropped. The barrier between judging and repairing is deliberate, because the repair stage needs the full set of valid findings before it can order them.

## Data model and contracts

The finding is the only structure crossing a stage boundary:

- `id`: the review thread's identifier, which keys the finding across stages.
- `path` and `line`: where the reviewer pointed.
- `body`: what the reviewer said.

Each stage adds to it:

- The judge adds `valid` and `reason`.
- The repairer adds `commit`, the commit carrying its repair.
- The verifier adds `closed`, `commit`, and `reason`, where the commit is the head it judged.

## Error handling

- **Missing or malformed arguments.** The workflow throws before dispatching anything, naming the missing keys.
- **No open findings.** The workflow returns empty lists rather than throwing. A round with nothing to do is a normal outcome for this workflow.
- **A judge that dies.** Its finding survives the round untouched, because an unjudged finding isn't a rejected one.
- **A repairer that dies or leaves no commit.** Its finding survives the round, and the round continues with the rest. A repair that produced no commit has nothing for a verifier to judge.
- **A verifier that dies.** Its finding survives. Silence isn't confirmation, which is the whole point of the rule.
- **More findings than the cap.** The round takes the cap's worth and reports the rest as dropped by name, so a truncated round never reads as a complete one.

## File map

- `.claude/workflows/fix-cycle.js`: the saved workflow that judges, repairs, and verifies one round of findings (create).
- `.claude/workflows/feature-kickoff.js`: the ledger arm drops its subagent type and queries the tracker (modify).
- `.claude/skills/feature-cycle/references/verification.md`: the fix cycle gains the workflow and the ledger convention (modify).
- `.claude/skills/feature-cycle/references/planning.md`: the arm table's ledger row changes to match (modify).
- `.claude/skills/feature-cycle/SKILL.md`: the rollout note's deferred list empties (modify).
- `docs/adr/0043-fix-cycle-and-the-rider-ledger.md`: the process record (create).
- `docs/adr/README.md`: the index row (modify).

## Interfaces

- Consumes: the workflow harness hooks `agent`, `parallel`, `phase`, `log`, and `args`; the repository's review threads through the command line.
- Produces:
  - The workflow's arguments: the repository slug and the pull request number.
  - The workflow's return value: the closed findings, the survivors, the rejected findings with their reasoning, the findings the cap dropped, and the head commit the verifiers judged.
  - The `rider` label as the ledger's only contract.

## Decisions

### 1. The ledger lives on the issue tracker

The tracker already carries this project's open work, it searches, it links from a pull request, and a session files an entry with one command. A file in the repository would need its own format, its own review, and its own tooling to stay honest.

**Alternatives considered:** a markdown ledger under `docs/`, rejected because it drifts and needs its own machinery to search. A new store of any other kind, rejected outright.

**Architecture Decision Record (ADR) draft:** [0043](../../../docs/adr/0043-fix-cycle-and-the-rider-ledger.md)

### 2. Nothing enforces that a discovery gets filed

A gate over filing would reward staying quiet, because the cheapest way past it would be to notice nothing. The ledger earns its use by being the outlet that keeps a round scoped, not by a check.

**Alternatives considered:** a gate demanding a ledger entry per round, rejected on the incentive it creates.

### 3. Every finding gets judged before a repairer touches it

This project already holds that a reviewer's finding gets checked against the code first. Half the defects this repository has recorded came from a wrong claim rather than wrong code. A repairer working from unread findings would turn that failure into a routine.

**Alternatives considered:** repairing every finding and letting the verifier catch the bad ones. Rejected, because a verifier confirms a defect's absence rather than a change's worth, so a wrong repair would pass.

### 4. Repairs run serially, judging and verifying run in parallel

The repairs share one worktree, so two at once collide. Judging and verifying stay read-only and independent, so they fan out. The barrier between judging and repairing is the one place the round genuinely needs the full set before continuing.

**Alternatives considered:** repairs in separate worktrees. Rejected, because the round produces one commit chain for one pull request, and merging parallel repair worktrees would cost more than the serial time it saves.

### 5. A verifier closes a finding only by failing to reproduce it

Confirmation has to be an attempt that fails, rather than an assertion that succeeds. The verifier reproduces the original defect against the repaired head, and a failed reproduction is the evidence. This copies the review pass's reproduce-or-drop rule.

**Alternatives considered:** trusting the repairer's own report, rejected because a repairer judging its own work is the drift the process assertion exists to catch.

### 6. The workflow runs one round and stops

The three-round cap ends in human triage, and a workflow takes no input once it starts. One round per run keeps the maintainer at the seam, matching how the discovery workflow stops at the brainstorm.

**Alternatives considered:** looping to the cap inside the workflow, rejected because the decision to open another round is the maintainer's.

### 7. The workflow neither pushes nor answers a thread

A reply on a review thread is a position this project takes, with reasoning. A rejected finding stays unresolved until the exchange settles. Automating the reply would turn a considered answer into an acknowledgement. The push stays with the maintainer for the same reason.

**Alternatives considered:** resolving threads for closed findings, rejected because the reply and the resolution travel together.

## Test matrix

| Layer          | What this layer proves (or why none)                                                                                                                  | Check command             |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Unit           | None. The change adds no importable module: the workflow uses top-level `await` and a top-level `return`, and the other edits are prose and a prompt. | none                      |
| Integration    | None, for the same reason. The workflow's hooks exist only inside the harness, matching how `review-pr.js` and `feature-kickoff.js` ship.             | `pnpm run test:workflows` |
| End-to-end     | None. The artifacts are development-pipeline machinery outside the desktop application.                                                               | none                      |
| Property       | None. No algebraic invariant is at stake.                                                                                                             | none                      |
| Mutation scope | None. The Stryker gate scopes to `apps/` and `packages/`, and this change adds nothing there.                                                         | `pnpm run test:mutation`  |

This change ships no test, which is a real cost rather than an oversight. Three things compensate. The workflow stays thin, its stage order and its caps stay literal constants, and the review pass on this branch is the only gate it gets. Two earlier workflows shipped on the same terms, and reading `feature-kickoff.js` surfaced five defects, which is the evidence that the reading gate has teeth.

## Task decomposition hooks

- Task 1: The ledger convention, the label, and the discovery arm (depends on: none, hands off: the label name the workflow and the references use).
- Task 2: The `fix-cycle` saved workflow (depends on: Task 1 for the label, hands off: the round contract the reference documents).
- Task 3: The verification and planning references, and the rollout note (depends on: Tasks 1 and 2).
- Task 4: The process record, ADR-0043 (depends on: every decision above).
- Task 5: The pull request.

## Risks

- [Risk] A judge rejects a valid finding, and the round drops a real defect → Mitigation: a rejection leaves the round with its reasoning attached and the thread stays unresolved, so the finding returns to the maintainer rather than disappearing.
- [Risk] A repairer commits a change that satisfies the verifier while breaking something else → Mitigation: the round's output is a commit chain on a branch, and the branch still faces the full gate suite and the review pass before it merges.
- [Risk] The workflow ships without a test, so a wrong stage order or a broken cap reaches the branch → Mitigation: the constants stay literal and the review pass reads them. The test matrix records this as an accepted cost rather than a covered one.
- [Risk] The ledger fills with entries nobody reads → Mitigation: the discovery arm reads it on every feature, which is the only consumer the design needs.

## Migration and rollout

None. The workflow is a new file, the label is new, and the reference edits describe what the code does. Rolling back means deleting one file and reverting three documents. No data migrates.

## Open questions

None.

## End-to-end verification

The `fix-cycle` workflow lists under its name in the harness. A run against a pull request with open review threads returns the four lists and a head commit, with every closed finding naming the commit its verifier judged.

A fresh-context reviewer diffs the result against these criteria:

- Judging runs before any repair, and no repair happens for a finding a judge rejected.
- Repairs run one at a time, and each produces its own commit.
- Verifiers run against the head the repairs produced, and a finding closes only on a verifier that failed to reproduce it.
- A dead subagent at any stage leaves its finding among the survivors, never among the closed.
- The round cap stays a literal constant, and the output names every finding the cap dropped.
- The workflow neither pushes nor resolves a thread.
- The ledger arm in `feature-kickoff.js` queries the tracker for the `rider` label, and `planning.md`'s arm table says so.
- The rollout note lists no deferred machinery.
