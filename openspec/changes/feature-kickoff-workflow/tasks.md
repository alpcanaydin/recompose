# Feature-kickoff-workflow tasks

> For agentic workers: use `superpowers:subagent-driven-development` to execute task by task. Every commit passes lefthook without bypass. Global constraints: never commit to `main`, no code comments, commit style `<type>: <imperative subject>` with at most 50 characters, and `pnpm exec openspec validate --all --strict --no-interactive` stays green after every task. Read [design.md](design.md) before starting a task; it holds the decisions these steps carry out.

## Task 1: The citation validator

**Files:**

- Create: `.claude/workflows/citation-validator/citation-validator.mts`
- Create: `.claude/workflows/citation-validator/citation-validator.test.mts`
- Create: `.claude/workflows/citation-validator/citation-validator.entrypoint.test.mts` (a further split follows the `describe` seams if the 300-line rule binds)

**Interfaces:**

- Consumes: the code-map entry list, and `isProcessEntryPoint` from `.claude/workflows/hooks/entry-point.mjs`.
- Produces: `validate(entries, readFile)` with the `CodeMapEntry`, `Verdict`, and `CitationFailure` types, plus the entry point's process contract Task 2 reads: the repository root as the first argument, the entry list on standard input, JSON on standard output, and exit codes zero, one, and two.

- [x] **Step 1: Write the failing spec and capture its red run**

Colocate the spec next to the script, run it through `node:test` under `pnpm run test:workflows`, and follow `path-guard.test.mts` for shape. The spec drives the pure verdict function. It takes the entry list and a file reader, then returns pass or fail with every failing citation named.

Cover the branches from the design's test matrix:

- A missing path fails and names itself.
- A missing symbol fails and names itself.
- A path escaping the repository root fails with a reason naming the escape, distinct from the missing-path reason.
- An entry whose path and every symbol resolve passes.
- A missing path reports once rather than once per symbol.
- An unreadable file fails for the reason that stopped the read.
- The entry point, in the path guard's style: the script runs against a scratch repository from an unrelated working directory, separates an input fault from a failing verdict by exit code, and prints JSON on standard output in every case.

The spec fails because the module doesn't exist. Capture that failing run into the task report as the red evidence.

- [x] **Step 2: Implement the validator and land one green commit**

Keep the whole validator self-contained in `.claude/workflows/citation-validator/citation-validator.mts`. Export the pure verdict function, then wire a thin entry point behind `isProcessEntryPoint` that supplies `node:fs` and prints the verdict. Match a symbol as a standalone token under the amended decision 4, and resolve no declarations. Don't extend the Stryker mutation scope and don't move the function into a domain package, matching the path guard's recorded exception. The spec and its implementation land together as one green commit.

```bash
git add .claude/workflows/citation-validator/
git commit -m "feat: citation validator for code maps"
```

## Task 2: The feature-kickoff saved workflow

**Files:**

- Create: `.claude/workflows/feature-kickoff.js`

**Interfaces:**

- Consumes: the `researcher` and `code-analyzer` subagent types, the workflow harness hooks, and the validator's JSON verdict from Task 1.
- Produces: the discovery directory contract that Task 3 documents.

- [x] **Step 1: Write the workflow**

Follow `.claude/workflows/review-pr.js` exactly for shape:

- A literal `meta` block with `name`, `description`, and `phases`.
- Argument validation that throws and names the missing keys.
- A literal blueprint table, with `parallel()` for the fan-out.
- Structured output through `schema`.
- Assertions that throw rather than warn.

The workflow takes `{ slug, tier }` and runs three phases:

- **Discover.** Fold the arm table by tier: the `full` tier dispatches four arms, and the `standard` tier folds to two, exactly as `references/planning.md` states. Assert the folded table stays within six arms, and throw when it doesn't. Dispatch in parallel. Each arm writes its own file into `openspec/changes/<slug>/discovery/` and returns its findings through a schema. The code-map arm returns entries carrying a path, its cited symbols, its Feature-Sliced Design layer, and a note, and the workflow renders the markdown from them.
- **Validate.** One cheap subagent runs the validator script over the entries and returns its verdict through a schema.
- **Recheck.** On a failing verdict, re-dispatch the `code-analyzer` arm once with the failing citations as input, then validate again. Throw on a second failure, naming every failing citation.

A dead `code-analyzer` throws, because validation then has nothing to check. A dead `researcher` logs and continues. Return the discovery directory, the arm labels with their files, the validated entries, and whether a recheck ran.

- [x] **Step 2: Verify the gates and commit**

Run: `pnpm run typecheck && pnpm run test:workflows`
Expected: both exit 0. The `.claude/workflows/` tree is already exempt from Vale and cspell, so no prose run applies.

```bash
git add .claude/workflows/feature-kickoff.js
git commit -m "feat: feature-kickoff discovery workflow"
```

## Task 3: The skill reference and the rollout note

**Files:**

- Modify: `.claude/skills/feature-cycle/references/planning.md`
- Modify: `.claude/skills/feature-cycle/SKILL.md`

**Interfaces:**

- Consumes: the workflow name, its arguments, and the discovery directory from Task 2.

- [x] **Step 1: Make the discovery step concrete**

In `references/planning.md` step 2, replace the improvised-dispatch language with the mechanism. Name the `feature-kickoff` saved workflow, its `{ slug, tier }` arguments, the cap assertion that throws, the validator's path, the single rerun on rejection, and `openspec/changes/<slug>/discovery/` as where the arms' files land. Keep the arm table and the standard-tier fold, because the workflow implements them rather than replacing them. State that the design-reference arm and the brainstorm stay in the session.

- [x] **Step 2: Update the rollout note**

In `SKILL.md`, drop the citation validator from the deferred list and add it to the sentence naming what exists, with its path. Leave the environment setup script, the finding-by-commit verifiers, and the rider ledger deferred.

- [x] **Step 3: Verify and commit**

Run: `pnpm exec openspec validate --all --strict --no-interactive`
Expected: exit 0. The skills tree stays prose-exempt, so no Vale or cspell run applies.

```bash
git add .claude/skills/feature-cycle/
git commit -m "docs: concrete discovery dispatch in the skill"
```

## Task 4: Process record

**Files:**

- Create: `docs/adr/0041-discovery-workflow-and-citation-validator.md` (0040 is the last taken number)
- Modify: `docs/adr/README.md`

**Interfaces:**

- Consumes: every decision from [design.md](design.md) in this change.

- [x] **Step 1: Write the record through the new-adr skill**

Cover all six decisions:

- The brainstorm seam, and why classification stays in the session.
- The code map as data, with the workflow rendering it.
- The no-model-call validator, with the research that backs it.
- The word-boundary symbol match, with its limit.
- The single rerun on a rejected map.
- The cap assertion's placement in the dispatching machinery.

Record the two limits plainly. The saved workflow ships with no spec, because no test can import it, and the symbol check proves a mention rather than a declaration. Record the mutation-scope exception and its compensating unit and integration cover. Write only what the code does, because a wrong sentence in a record misdirects the next implementer.

- [x] **Step 2: Update the index**

Add the row to `docs/adr/README.md` in the existing format.

- [x] **Step 3: Verify and commit**

Run: `mise exec -- vale docs/adr/0041-discovery-workflow-and-citation-validator.md && pnpm exec cspell --no-progress docs/adr/`
Expected: 0 errors from both.

```bash
git add docs/adr/
git commit -m "docs: adr for the discovery workflow"
```

## Task 5: Pull request

**Files:** none (process step).

- [x] **Step 1: Final validation sweep**

Run: `pnpm exec openspec validate --all --strict --no-interactive && pnpm run lint:prose && pnpm run lint:spell && pnpm run typecheck && pnpm run test:workflows`
Expected: all exit 0.

- [x] **Step 2: Push and review**

Push the branch, then run the heavy adversarial review over the pushed head before opening the pull request.

- [x] **Step 3: Open the pull request**

Body names the change directory, the modified capability, and the Architecture Decision Record (ADR) 0041.
