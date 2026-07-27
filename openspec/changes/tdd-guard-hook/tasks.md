# Tdd-guard-hook tasks

> For agentic workers: use `superpowers:subagent-driven-development` to execute task by task. Every commit passes lefthook without bypass. Global constraints: never commit to `main`, no code comments, no em dash in prose, commit style `<type>: <imperative subject>` with at most 50 characters, and one green commit per task. Never commit a failing state: write the failing spec, run it, paste the full red output into the task report, then implement to green and commit once.

## Task 1: Restore edits under `.claude`

**Files:**

- Create: `.claude/workflows/hooks/hook-scope.test.mts`
- Modify: `.claude/settings.json`, `package.json`

**Interfaces:**

- Consumes: the `PostToolUse` hook command already configured for `Edit|Write`.
- Produces: a working edit path under `.claude` that every later task depends on, and the spec directory the `test:workflows` script reaches.

- [ ] **Step 1: Write the failing spec and capture its red run**

The current hook exits 2 for every `.ts`, `.js`, or `.mts` edit under `.claude`, because `.claude/**` sits in the linter's ignore list and the linter answers an ignored path with exit 1 and `No files found to lint`. The hook reads that as a lint failure.

Write `.claude/workflows/hooks/hook-scope.test.mts` with `node:test`, matching the style of `.claude/workflows/path-guard/path-guard.test.mts`. The spec reads the `Edit|Write` `PostToolUse` command out of `.claude/settings.json`, then runs it through a shell with the hook payload on standard input and the repository root as the working directory. Name each case in domain language, and assert on the exit code.

Three cases:

1. A path inside the linter's ignore scope, such as an existing file under `.claude/workflows/`, exits 0.
2. A clean source file the linter does lint, such as `vitest.shared.ts`, exits 0.
3. A source file carrying a real lint error exits 2. Create that file in the spec and remove it in a teardown hook, so the tree stays clean when the spec fails. A root-level `.ts` file with a blank-line violation reproduces an error-level exit.

Widen the `test:workflows` script in `package.json` so it reaches the new directory as well as the path-guard directory. Run `pnpm run test:workflows` and paste the full failing output into the task report. Case 1 fails before the fix and cases 2 and 3 pass.

- [ ] **Step 2: Apply the flag and land one green commit**

Add `--no-error-on-unmatched-pattern` to both the formatter and the linter invocation inside the `PostToolUse` command in `.claude/settings.json`. The flag already appears in `lefthook.yml` for the same reason, so the hook stops inventing a second copy of an ignore list that the linter configuration already holds.

Verify: `pnpm run test:workflows` passes all three cases, and `pnpm run typecheck:workflows` exits 0. The spec and the fix land together as one green commit.

```bash
git add .claude/settings.json .claude/workflows/hooks/ package.json
git commit -m "fix: stop the format hook blocking .claude edits"
```

## Task 2: Wire the reporter and the guard scope

**Files:**

- Create: `.claude/tdd-guard/data/config.json`
- Modify: `apps/desktop/vitest.config.ts`, `apps/desktop/package.json`, `packages/contracts/vitest.config.ts`, `packages/contracts/package.json`, `.gitignore`

**Interfaces:**

- Consumes: the working edit path from Task 1.
- Produces: the committed scope contract and the reporter registration the gate reads in Task 3.

- [ ] **Step 1: Register the reporter in both vitest configurations**

Add `tdd-guard-vitest` at its exact current version to the dev dependencies of both `apps/desktop` and `packages/contracts`. The reporter declares a `vitest >=3.2.4` peer range, which 4.1.10 satisfies.

Register it at the root of the `test` block in each configuration, next to the existing default reporter. A root-level reporter receives modules from every entry of a `projects` array, so `apps/desktop` needs one registration rather than three.

Pass `projectRoot` as the repository root resolved from `import.meta.url`. Never write a literal absolute path: a committed file must not carry a machine path or an account name.

Verify: run each package's suite and confirm `.claude/tdd-guard/data/test.json` appears and holds the run.

- [ ] **Step 2: Write the guard scope and keep the state out of version control**

Create `.claude/tdd-guard/data/config.json` with `guardEnabled` set to true and an `ignorePatterns` list. A custom list replaces the upstream defaults outright. Restate every default this repository keeps: `*.md`, `*.txt`, `*.log`, `*.json`, `*.yml`, `*.yaml`, `*.xml`, `*.html`, `*.css`. Then add the trees outside the inner loop: `.claude/**`, `**/*.config.*`, `**/*.stories.tsx`, `**/.storybook/**`, `**/e2e/**`, and `scripts/**`. What stays guarded is `apps/desktop/src` and `packages/contracts/src`.

Settle one upstream detail against the running guard rather than against the documentation: whether the matcher applies patterns to a repository-relative path or an absolute path. Record the evidence in the task report, and adjust the pattern list to whichever base the guard uses.

Add the ignore rule that excludes the guard's state directory and re-admits this one file. The shared contract stays in version control, and the machine-local run state stays out.

- [ ] **Step 3: Clear the gates and commit**

The reporter reaches the configuration as a string, so the dead-code gate may read the dependency as unused. Run `pnpm run lint:dead` and add the dependency to the matching `ignoreDependencies` list in `knip.json` when the gate flags it. Add any new vocabulary to `cspell-words.txt`.

Verify: the commit passes lefthook without bypass, and `pnpm run test` stays green.

```bash
git add apps/desktop packages/contracts .claude/tdd-guard .gitignore pnpm-lock.yaml
git commit -m "build: wire the tdd-guard vitest reporter"
```

## Task 3: Install the plugin and confirm the gate

**Files:**

- Modify: `.claude/settings.json`

**Interfaces:**

- Consumes: the reporter registration and the scope contract from Task 2.
- Produces: the settings entries that arm the gate, and the smoke evidence in the task report.

> This task needs the maintainer. A marketplace command runs in the interactive session, so a subagent can't finish it alone. Prepare the commands, hand them over, then commit the result.

- [ ] **Step 1: Hand the install commands to the maintainer**

The two commands are `/plugin marketplace add nizos/tdd-guard` and `/plugin install tdd-guard@tdd-guard`. They add a marketplace entry and an enabled-plugin entry to `.claude/settings.json`, matching the shape the five existing plugins already use. The hooks may load only after a session restart.

- [ ] **Step 2: Smoke the gate and record the evidence**

With the plugin loaded, run four checks and paste each outcome into the task report:

1. Edit a file under `apps/desktop/src` with no failing test behind it. The gate denies the call and gives a reason.
2. Write a failing test, run the suite, then repeat the edit. The gate lets it through.
3. Edit a markdown file. No gate interferes.
4. Edit a file under `.claude`. No gate interferes, which also confirms Task 1 holds with both hooks armed.

- [ ] **Step 3: Commit the settings entries**

Verify: the commit passes lefthook without bypass, and `pnpm run test:workflows` still passes with the new settings content.

```bash
git add .claude/settings.json
git commit -m "build: arm the tdd-guard edit-time gate"
```

## Task 4: Fold the mechanism into the skill

**Files:**

- Modify: `.claude/skills/feature-cycle/SKILL.md`, `.claude/skills/feature-cycle/references/implementation.md`, `.claude/skills/feature-cycle/references/verification.md`

**Interfaces:**

- Consumes: the shipped gate from Task 3 and Decision 5 from `design.md`.

- [ ] **Step 1: Move the gate out of the deferred list**

The Enforcement rollout note in `SKILL.md` lists the gate among the deferred machinery. Move it to the shipped sentence and name where it lives: the upstream plugin supplies the hooks, and `.claude/tdd-guard/data/config.json` holds the scope.

- [ ] **Step 2: Make the mechanism concrete in the implementation reference**

The Red-run evidence section already describes the gate in the abstract. Replace that description with the mechanism and its scope, and state that the gate covers subagent tool calls, so the executor's implementers run under it.

- [ ] **Step 3: Add the incremental convention to the verification reference**

The Commit chain section describes the review pass. Add the convention: the first pass takes the pull request base, and each later pass takes the previous reviewed head as `baseSha`, so it reviews the increment. State the ceiling in one line, that the guard can't walk the chain, and point at the record.

- [ ] **Step 4: Verify and commit**

Verify: the commit passes lefthook without bypass. The skills tree stays exempt from the prose gates, so the validation gate is the one that matters here.

```bash
git add .claude/skills/feature-cycle/
git commit -m "docs: shipped tdd gate and incremental review"
```

## Task 5: Process record

**Files:**

- Create: `docs/adr/0040-edit-time-test-first-gate.md` (0039 is the last taken number)
- Modify: `docs/adr/README.md`

**Interfaces:**

- Consumes: every decision from `design.md` in this change.

- [ ] **Step 1: Write the record through the new-adr skill**

Cover the three-tier enforcement stack and why the edit-time tier is a heuristic rather than a deterministic gate. Cover the plugin installation with its unpinned-command exposure and the reasoning that accepted it. Cover the source-tree scope, the computed project root, the formatter-hook flag, and the incremental review convention with its chain ceiling and named upgrade path. Record the deliberate test gap: one deterministic spec covers the formatter hook, and the guard's own scope stays a recorded manual smoke step. Full prose, clean under both prose gates.

- [ ] **Step 2: Update the index**

Add the row to `docs/adr/README.md` in the existing format.

- [ ] **Step 3: Verify and commit**

Verify: the commit passes lefthook without bypass.

```bash
git add docs/adr/ cspell-words.txt
git commit -m "docs: adr for the edit-time test gate"
```

## Task 6: Verification and pull request

**Files:** none (process step).

- [ ] **Step 1: Rules review and full gate sweep**

Run a `rules-reviewer` pass over the branch diff and fix its findings in the worktree. Then run `pnpm run lint:openspec`, `pnpm run lint:prose`, `pnpm run lint:spell`, `pnpm run typecheck`, `pnpm run test`, and `pnpm run test:workflows`. All exit 0.

- [ ] **Step 2: Push, review, then open**

Push the branch. Run `/review-pr` on the pushed head with `sha`, `repo`, and `baseSha`. This change touches the settings file, the package manifests, and the workflow tree, so the path guard demands the review status. Fix any surviving finding, push again, and re-review with the previous reviewed head as `baseSha`. Prepare the `gh pr create` command for the maintainer with a body naming the change directory, the modified capability, and the record.
