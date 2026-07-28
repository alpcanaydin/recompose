# Fix-cycle-machinery tasks

> For agentic workers: use `superpowers:subagent-driven-development` to execute task by task. Every commit passes lefthook without bypass. Global constraints: never commit to `main`, no code comments, commit style `<type>: <imperative subject>` with at most 50 characters, and `pnpm exec openspec validate --all --strict --no-interactive` stays green after every task. Read [design.md](design.md) before starting a task; it holds the decisions these steps carry out.

## Task 1: The ledger and the discovery arm

**Files:**

- Modify: `.claude/workflows/feature-kickoff.js`

**Interfaces:**

- Consumes: the repository's issue tracker.
- Produces: the `rider` label as the ledger's only contract, which Tasks 2 and 3 name.

- [ ] **Step 1: Create the label**

The ledger is issues carrying one label. Prepare the command that creates it and hand it to the maintainer, matching how this repository handles tracker mutations:

```bash
gh label create rider --repo recomposesh/recompose --color D4C5F9 --description "Out-of-scope discovery parked from a fix cycle; read by the discovery phase"
```

Match the existing labels' voice: read `gh label list` first, and note that the three exemption labels carry a description saying what the label demands.

- [ ] **Step 2: Redirect the ledger arm**

In `.claude/workflows/feature-kickoff.js`, the `rider-ledger` arm currently runs on `code-analyzer`, so it searches the source tree for something that lives on the tracker. Drop its subagent type so the arm runs on the default subagent, whose command access reaches the tracker. Then rewrite the arm's focus text to say what it must do. It reads the open issues carrying the `rider` label, and reports the prior findings that touch this feature, with issue numbers.

Keep the arm's label, its kind, and its position in the table. The dispatch count doesn't change, so the cap arithmetic in `assertDispatchCapRespected` stays as it is. Confirm that by reading it rather than assuming.

- [ ] **Step 3: Verify and commit**

Run: `pnpm run typecheck && pnpm run test:workflows`
Expected: both exit 0. The `.claude/workflows/` tree is exempt from Vale and cspell.

```bash
git add .claude/workflows/feature-kickoff.js
git commit -m "fix: point the ledger arm at the tracker"
```

## Task 2: The fix-cycle saved workflow

**Files:**

- Create: `.claude/workflows/fix-cycle.js`

**Interfaces:**

- Consumes: the workflow harness hooks, the repository's review threads, and the `rider` label from Task 1.
- Produces: the round contract Task 3 documents: the closed findings, the survivors, the rejected findings with their reasoning, the findings the cap dropped, and the head commit the verifiers judged.

- [ ] **Step 1: Write the workflow**

Follow `.claude/workflows/review-pr.js` exactly for shape:

- A literal `meta` block with `name`, `description`, and `phases`.
- Argument validation that throws and names the missing keys.
- Structured output through `schema` on every dispatch.
- Assertions that throw rather than warn.
- A literal constant for every cap.

The workflow takes the repository slug and the pull request number, reads the unresolved review threads, and runs three phases:

- **Judge.** Every finding goes to a judge in parallel, read-only. A judge returns valid or invalid with its reasoning. This stage exists because this project judges a reviewer's finding against the code before anyone acts on it, so no repair may run without a judgement.
- **Repair.** The valid findings go to a repairer one at a time, never in parallel: they share one worktree. Each repairer commits its own repair.
- **Verify.** Every repaired finding goes to its own verifier in parallel, against the head the repairs produced. A verifier tries to reproduce the original defect and closes the finding only when it can't.

Cap the findings per round with a literal constant, and name every finding the cap dropped in the output. A dead subagent at any stage leaves its finding among the survivors, never among the closed. The workflow neither pushes nor replies on a thread nor resolves one. Read the design's Error handling section and implement every case in it.

- [ ] **Step 2: Verify the gates and commit**

Run: `pnpm run typecheck && pnpm run test:workflows`
Expected: both exit 0.

```bash
git add .claude/workflows/fix-cycle.js
git commit -m "feat: fix-cycle workflow for one round"
```

## Task 3: The references and the rollout note

**Files:**

- Modify: `.claude/skills/feature-cycle/references/verification.md`
- Modify: `.claude/skills/feature-cycle/references/planning.md`
- Modify: `.claude/skills/feature-cycle/SKILL.md`

**Interfaces:**

- Consumes: the workflow's name, its arguments, and its round contract from Task 2, and the label from Task 1.

- [ ] **Step 1: Make the fix cycle concrete**

In `verification.md`, the Fix cycle section states the rules abstractly. Name the `fix-cycle` saved workflow, its arguments, its three stages in order, and what it returns. State plainly that the workflow runs one round and stops, because the three-round cap ends in human triage. State that it neither pushes nor answers a thread, and why. Replace the abstract sentence about the ledger with the mechanism: issues carrying the `rider` label, what an entry names, and that nothing gates the filing.

- [ ] **Step 2: Correct the arm table**

In `planning.md`, the discovery arm table's ledger row says the arm runs on `code-analyzer`. Task 1 changed that. Correct the row and the surrounding prose so a reader trusts the table.

- [ ] **Step 3: Empty the rollout note**

In `SKILL.md`, the rollout note lists the finding-by-commit verifiers and the rider ledger as deferred. Both now exist. Rewrite the paragraph so it names what exists and defers nothing, and read the whole paragraph first so the result reads in one voice rather than as an edit seam.

- [ ] **Step 4: Verify and commit**

Run: `pnpm exec openspec validate --all --strict --no-interactive`
Expected: exit 0. The skills tree stays prose-exempt.

```bash
git add .claude/skills/feature-cycle/
git commit -m "docs: concrete fix cycle in the skill"
```

## Task 4: Process record

**Files:**

- Create: `docs/adr/0043-fix-cycle-and-the-rider-ledger.md` (0042 is the last taken number)
- Modify: `docs/adr/README.md`

**Interfaces:**

- Consumes: every decision from [design.md](design.md) in this change.

- [ ] **Step 1: Write the record through the new-adr skill**

Cover all seven decisions:

- The ledger on the tracker, and why no new store.
- Why nothing gates the filing of a discovery.
- Judging before repairing, and the defect class it exists to stop.
- Serial repairs against parallel judging and verifying.
- A verifier that closes a finding only by failing to reproduce it.
- One round per run, and the seam that keeps the maintainer in it.
- No push and no thread reply, and why a reply is a position rather than an acknowledgement.

Record the cost plainly: the workflow ships with no test, because no test can import it, and the reading review is the only gate it gets. Name the two workflows that shipped on the same terms. Write only what the code does.

- [ ] **Step 2: Update the index**

Add the row to `docs/adr/README.md` in the existing format.

- [ ] **Step 3: Verify and commit**

Run: `mise exec -- vale docs/adr/0043-fix-cycle-and-the-rider-ledger.md && pnpm exec cspell --no-progress docs/adr/`
Expected: 0 errors from both.

```bash
git add docs/adr/
git commit -m "docs: adr for the fix cycle and the ledger"
```

## Task 5: Pull request

**Files:** none (process step).

- [ ] **Step 1: Final validation sweep**

Run: `pnpm exec openspec validate --all --strict --no-interactive && pnpm run lint:prose && pnpm run lint:spell && pnpm run typecheck && pnpm run test:workflows`
Expected: all exit 0.

- [ ] **Step 2: Push and review**

Push the branch, then run the heavy adversarial review over the pushed head before opening the pull request. This branch touches `.claude/workflows/`, which is a blast-radius path, so the path guard demands the review status on the head.

- [ ] **Step 3: Open the pull request**

Body names the change directory, the modified capability, and the Architecture Decision Record (ADR) 0043. It also names the label command from Task 1, so the maintainer runs it.
