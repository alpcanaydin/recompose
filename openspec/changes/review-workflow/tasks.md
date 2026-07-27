# Review-workflow tasks

> For agentic workers: use `superpowers:subagent-driven-development` to execute task by task. Every commit passes lefthook without bypass. Global constraints: never commit to `main`, no code comments, commit style `<type>: <imperative subject>` with at most 50 characters, and `pnpm exec openspec validate --all --strict --no-interactive` stays green after every task.

## Task 1: The review-pr saved workflow

**Files:**

- Create: `.claude/workflows/review-pr.js`

**Interfaces:**

- Consumes: the `adversarial-reviewer` seat, the model map, and the process assertion from the feature-cycle skill.
- Produces: the `feature-cycle/reviewed` commit status that Task 2 reads.

- [x] **Step 1: Write the workflow**

The workflow runs by name and drives the heavy review pass. It dispatches two `adversarial-reviewer` seats over the same diff. One seat keeps its `opus` pin. The other takes the most capable model through the `model` parameter at dispatch. A disagreement escalates to a judge at maximum effort. The workflow applies reproduce-or-drop and the confidence threshold of 80. It asserts two distinct reviewer subagents ran, then posts the `feature-cycle/reviewed` status on the head commit through `gh api`. The status post happens only after the assertion passes.

- [x] **Step 2: Verify the prose gates**

Run: `mise exec -- vale .claude/workflows/ && pnpm exec cspell --no-progress .claude/workflows/`
Expected: 0 errors from both. The workflow carries dispatch tables and tool syntax like the skills tree, so add `.claude/workflows` to the Vale exemption block and the cspell ignore list, matching `.claude/commands`.

- [x] **Step 3: Commit**

```bash
git add .claude/workflows/ .vale.ini cspell.json knip.json
git commit -m "feat: review-pr saved workflow"
```

## Task 2: The path-guard script and its wiring

**Files:**

- Create: `.claude/workflows/path-guard/path-guard.mts`, self-contained like `check-licenses.mjs`.
- Create: `.claude/workflows/path-guard/path-guard.test.mts`, colocated next to the script.
- Modify: `.github/workflows/ci.yml`

**Interfaces:**

- Consumes: the changed-path list and the head commit statuses.
- Produces: a pass or fail exit for the `path-guard` job behind `ci-success`.

- [x] **Step 1: Write the failing spec and capture its red run**

Colocate `.claude/workflows/path-guard/path-guard.test.mts` next to the script. Wire it into the existing node-side vitest project, or add a minimal project when none covers `scripts/`. The spec drives the pure decision function that takes the changed-path list and the head commit statuses, then returns pass or fail. Cover three cases: a blast-radius hit without the status, a blast-radius hit with the status, and a clean path that skips the guard. The spec fails because the function doesn't exist yet. Capture that failing run into the task report as the red evidence.

- [x] **Step 2: Implement the guard and land one green commit**

Keep the whole guard self-contained in `.claude/workflows/path-guard/path-guard.mts`, like `check-licenses.mjs`. Export the pure decision function so the spec passes, then read the two inputs and call it. Don't extend the Stryker mutation scope, and don't move the function into a domain package. The three-case unit spec is the compensating cover for that scope exception. The spec and its implementation land together as one green commit.

```bash
git add .claude/workflows/path-guard/
git commit -m "feat: blast-radius path-guard logic"
```

- [x] **Step 3: Wire the `ci.yml` job**

Add a `path-guard` job. It computes the changed-path list, fetches the head commit statuses through `gh api`, then runs the script. Add the job to the `ci-success` needs list. Keep the job step thin, so the tested function owns the decision.

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run the path guard behind ci-success"
```

## Task 3: Record the marker mechanism in the skill

**Files:**

- Modify: `.claude/skills/feature-cycle/references/verification.md`

**Interfaces:**

- Consumes: the marker decision from `design.md` in this change.

- [x] **Step 1: Make the marker concrete**

Replace the abstract pipeline-marker language with the mechanism. State that the `review-pr` workflow posts the `feature-cycle/reviewed` commit status on the head commit through `gh api` after the process assertion passes. State that the path guard reads that status in continuous integration.

- [x] **Step 2: Add the post-archive Purpose step**

The Merge section gains one step. After OpenSpec archives the change, fill the merged spec's Purpose from the delta, because the archive step leaves it empty.

- [x] **Step 3: Verify and commit**

Run: `pnpm exec openspec validate --all --strict --no-interactive`
Expected: exit 0. The skills tree stays prose-exempt, so no Vale or cspell run applies.

```bash
git add .claude/skills/feature-cycle/references/verification.md
git commit -m "docs: concrete review marker in the skill"
```

## Task 4: Process record

**Files:**

- Create: `docs/adr/0039-review-pass-marker-and-path-guard.md` (0038 is the last taken number)
- Modify: `docs/adr/README.md`

**Interfaces:**

- Consumes: every decision from `design.md` in this change.

- [ ] **Step 1: Write the record through the new-adr skill**

Cover the per-commit status marker with its staleness rationale, the guard-in-script placement with the mutation constraint, and the concrete blast-radius set. The record also covers the saved-workflow reviewer mechanics and the drift-protection trust model. It records the mutation-scope exception and its compensating three-case unit spec. Full prose, Vale and cspell clean.

- [ ] **Step 2: Update the index**

Add the row to `docs/adr/README.md` in the existing format.

- [ ] **Step 3: Verify and commit**

Run: `mise exec -- vale docs/adr/0039-review-pass-marker-and-path-guard.md && pnpm exec cspell --no-progress docs/adr/`
Expected: 0 errors from both.

```bash
git add docs/adr/
git commit -m "docs: adr for the review path guard"
```

## Task 5: Pull request

**Files:** none (process step).

- [ ] **Step 1: Final validation sweep**

Run: `pnpm exec openspec validate --all --strict --no-interactive && pnpm run lint:prose && pnpm run lint:spell`
Expected: all exit 0.

- [ ] **Step 2: Push and hand over**

Push the branch. Prepare the `gh pr create` command for the owner with a body that names the change directory, the modified capability, and the Architecture Decision Record (ADR).
