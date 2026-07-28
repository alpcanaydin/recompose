# Discovery-ledger tasks

> For agentic workers: use `superpowers:subagent-driven-development` to execute task by task. Every commit passes lefthook without bypass. Global constraints: never commit to `main`, no code comments, commit style `<type>: <imperative subject>` with at most 50 characters, and `pnpm exec openspec validate --all --strict --no-interactive` stays green after every task. Read [design.md](design.md) before starting a task.

## Task 1: The label and both tiers' ledger arms

**Files:**

- Modify: `.claude/workflows/feature-kickoff.js`

**Interfaces:**

- Consumes: the repository's issue tracker.
- Produces: the `rider` label as the ledger's only contract, which Task 2 names.

- [x] **Step 1: Create the label**

Done by the maintainer:

```bash
gh label create rider --repo recomposesh/recompose --color D4C5F9 --description "Out-of-scope discovery parked from a fix cycle; read by the discovery phase"
```

- [x] **Step 2: Redirect the full tier's ledger arm**

The `rider-ledger` arm searched the source tree for something that lives on the tracker. Its focus text never said where a ledger would be. `code-analyzer` already carries a command tool, so the arm keeps that type and its focus text now names the label and the command to run.

- [x] **Step 3: Redirect the standard tier's folded arm**

The `standard` tier folds its lines of enquiry into two arms. The folded arm asked for prior out-of-scope findings while running on `researcher`, whose tool pins carry no command access. That arm keeps `researcher` and drops the ledger clause, so the `standard` tier stops consulting the ledger. `planning.md`'s standard-tier paragraph states that loss and its reason.

- [x] **Step 4: Verify and commit**

Run: `pnpm run typecheck && pnpm run test:workflows && pnpm exec openspec validate --all --strict --no-interactive`
Expected: all exit 0, with the workflow suite still at 98 passing.

## Task 2: The references and the rollout note

**Files:**

- Modify: `.claude/skills/feature-cycle/references/planning.md`
- Modify: `.claude/skills/feature-cycle/references/verification.md`
- Modify: `.claude/skills/feature-cycle/SKILL.md`

**Interfaces:**

- Consumes: the label and the arm shape from Task 1.

- [x] **Step 1: Correct the arm table**

In `planning.md` step 2, the arm table's ledger row names `code-analyzer`. Task 1 changed that on both tiers. Correct the row, the standard-tier paragraph, and any surrounding prose the change made false.

- [x] **Step 2: Give the ledger its mechanism**

In `verification.md`, the fix-cycle section says an out-of-scope discovery lands in the rider ledger. Replace that with the mechanism: issues carrying the `rider` label, what an entry names, that the discovery phase reads it, and that nothing gates the filing, with the reason.

- [x] **Step 3: Update the rollout note**

In `SKILL.md`, the rollout note defers the finding-by-commit verifiers and the rider ledger. The ledger now exists, so it moves to the sentence naming what exists. The verifier stays deferred, and the note says it waits until a feature has run through the pipeline.

- [x] **Step 4: Verify and commit**

Run: `pnpm exec openspec validate --all --strict --no-interactive`
Expected: exit 0.

## Task 3: Pull request

**Files:** none (process step).

- [ ] **Step 1: Final validation sweep**

Run: `pnpm exec openspec validate --all --strict --no-interactive && pnpm run lint:prose && pnpm run lint:spell && pnpm run typecheck && pnpm run test:workflows`
Expected: all exit 0.

- [ ] **Step 2: Push, review, open**

This branch touches `.claude/workflows/`, a blast-radius path, so the path guard demands the review status on the head. Push, review the pushed head, then open the pull request naming the change directory and the modified capability. No Architecture Decision Record (ADR) applies: the design records the three decisions, and none of them meets the record bar on its own.
