# Tdd-guard-hook tasks

> For agentic workers: use `superpowers:subagent-driven-development` to execute task by task. Every commit passes lefthook without bypass. Global constraints: never commit to `main`, no code comments, no em dash in prose, commit style `<type>: <imperative subject>` with at most 50 characters, and one green commit per task. Never commit a failing state: write the failing spec, run it, paste the full red output into the task report, then implement to green and commit once. Every dependency pins to an exact version. No committed file carries an absolute machine path.

## Task 1: Restore edits under `.claude`

**Files:**

- Create: `.claude/workflows/hooks/hook-scope.test.mts`
- Modify: `.claude/settings.json`, `package.json`

**Interfaces:**

- Consumes: the `PostToolUse` hook command already configured for `Edit|Write`.
- Produces: a working edit path under `.claude` that every later task depends on, and the spec directory the `test:workflows` script reaches.

- [x] **Step 1: Write the failing spec and capture its red run**

The current hook exits 2 for a script edit under `.claude`, because `.claude/**` sits in the linter's ignore list and the linter answers an ignored path with exit 1 and `No files found to lint`. The hook reads that as a lint failure. The hook's pattern list covers `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, and `.cjs`, and skips `.mts`, so `.claude/workflows/review-pr.js` is the file affected today.

Write `.claude/workflows/hooks/hook-scope.test.mts` with `node:test`, matching the style of `.claude/workflows/path-guard/path-guard.test.mts`. The spec reads the `Edit|Write` `PostToolUse` command out of `.claude/settings.json`, then runs it through a shell with the hook payload on standard input and the repository root as the working directory.

Three cases:

1. A path inside the linter's ignore scope whose extension the hook does match, such as `.claude/workflows/review-pr.js`, exits 0. An `.mts` path would skip the branch under test, so don't use one here.
2. A clean source file the linter does lint, such as `vitest.shared.ts`, exits 0.
3. A source file carrying a real lint error exits 2. Create that file in the spec and remove it in a teardown hook.

Widen the `test:workflows` script so it reaches the new directory as well as the path-guard directory.

- [x] **Step 2: Apply the flag and land one green commit**

Add `--no-error-on-unmatched-pattern` to both the formatter and the linter invocation inside the `PostToolUse` command.

## Task 2: Pin the gate and declare its scope

**Files:**

- Create: `probity.config.ts`
- Modify: `package.json`, `knip.json`

**Interfaces:**

- Consumes: the working edit path from Task 1.
- Produces: the pinned binary and the committed scope contract that Task 3 arms.

> Read the upstream reference before writing anything, because this project ships weekly and memory is stale. Fetch `https://raw.githubusercontent.com/nizos/probity/main/docs/configuration.md` and `https://raw.githubusercontent.com/nizos/probity/main/docs/rules.md`, and follow their current shape rather than any example in this file.

- [ ] **Step 1: Pin the dependency and confirm the binary resolves**

Add `@nizos/probity` at exactly `1.10.0` to the root `package.json` dev dependencies. It's a command the hook runs, not a module any package imports, so it belongs at the root and nowhere else. Install through `pnpm add --save-dev --save-exact --workspace-root`, never by editing the lockfile, which a hook blocks.

The package declares peer dependencies on several syntax-tree language packs this repository has no use for. Don't add them. If the install demands them, reach for the workspace's peer-dependency ignore mechanism rather than pulling four unused native packages into the lockfile.

Verify: `./node_modules/.bin/probity --help` resolves and prints usage. Record the output in the report, along with the subcommands it offers, because Task 3 needs to know whether the binary can explain a configuration without a live edit.

- [ ] **Step 2: Write the scope contract**

Create `probity.config.ts` at the repository root, following the upstream flat shape. Bind the test-first rule to the source trees alone:

- Guarded: `apps/desktop/src` and `packages/contracts/src`.
- Outside every rule: test files, type-level specs, stories, generated modules, configuration modules, the end-to-end tree, the Storybook configuration, and everything under `.claude`.

Writing a test must never trip the rule that demands one. Confirm against the upstream reference how the tool classifies a test file. State in the report which mechanism handles it: a built-in classification, or an explicit exclusion you wrote.

Globs resolve against this file's own directory. Never write an absolute path.

- [ ] **Step 3: Clear the gates and commit**

Nothing imports the binary, so the dead-code gate will flag it. Run `pnpm run lint:dead` and record it in the root workspace's `ignoreDependencies`. Add any new vocabulary to `cspell-words.txt`. `probity.config.ts` sits at the repository root, so the typecheck and lint gates cover it: keep it under the repository's strict settings with no comments.

Verify: the commit passes lefthook without bypass, and `pnpm run typecheck` exits 0.

```bash
git add package.json pnpm-lock.yaml probity.config.ts knip.json cspell-words.txt
git commit -m "build: pin the probity gate and its scope"
```

## Task 3: Arm the gate and prove both directions

**Files:**

- Modify: `.claude/settings.json`

**Interfaces:**

- Consumes: the pinned binary and the scope contract from Task 2.
- Produces: the armed hook and the probe evidence in the task report.

- [ ] **Step 1: Settle the load-bearing assumption first, before arming anything**

The whole design rests on one claim: the gate reads the calling session's own transcript, so a subagent sees its own test run and never another worktree's. Prove or disprove it before adding the hook.

Read how the tool resolves the transcript. Then check whether a subagent's hook payload carries a transcript path pointing at that subagent's own record rather than the parent session's. The repository already proved that `PreToolUse` fires inside subagents, so the open half is whose transcript arrives.

If the answer is negative, stop and report BLOCKED with the evidence. Don't work around it. A gate that reads the wrong session is worse than no gate, and the maintainer decides what happens next.

- [ ] **Step 2: Arm the hook**

Add a `PreToolUse` entry to `.claude/settings.json` matching the editing tools, running `./node_modules/.bin/probity` with the flag that selects Claude Code as the host. Match the existing hooks' style in that file, and set an explicit timeout the way the other entries do. Don't match shell commands: Decision 6 in `design.md` states that boundary and its reason. Leave every existing hook untouched.

- [ ] **Step 3: Probe both directions and record the evidence**

A gate that blocks everything and a gate that blocks nothing both look quiet from the outside, so prove each direction and paste both outcomes into the report:

1. Edit a file under `apps/desktop/src` with no failing test in the session. The gate denies the call and gives a reason.
2. Write a failing test, run that package's suite in the same session, then repeat the edit. The gate lets it through.
3. Edit a markdown file, a configuration module, and a file under `.claude`. No gate interferes, which also confirms Task 1 holds with both hooks armed.

Revert any scratch edit the probe made. The commit carries the settings change alone.

- [ ] **Step 4: Commit**

Verify: the commit passes lefthook without bypass, and `pnpm run test:workflows` still passes with the new settings content.

```bash
git add .claude/settings.json
git commit -m "build: arm the edit-time test-first gate"
```

## Task 4: Fold the mechanism into the skill

**Files:**

- Modify: `.claude/skills/feature-cycle/SKILL.md`, `.claude/skills/feature-cycle/references/implementation.md`, `.claude/skills/feature-cycle/references/verification.md`

**Interfaces:**

- Consumes: the armed gate from Task 3 and Decision 7 from `design.md`.

- [ ] **Step 1: Move the gate out of the deferred list**

The Enforcement rollout note in `SKILL.md` lists the gate among the deferred machinery. Move it to the shipped sentence and name where it lives: a pinned dependency, a `PreToolUse` hook, and `probity.config.ts` for the scope.

- [ ] **Step 2: Make the mechanism concrete in the implementation reference**

The Red-run evidence section describes the gate in the abstract. Replace that with the mechanism. The gate reads the session's own transcript, it covers subagent tool calls, and its scope is the source trees. It sits above the deterministic gates rather than replacing them. State the one operational consequence for implementers: the failing test run must happen in the same session as the edit.

- [ ] **Step 3: Add the incremental convention to the verification reference**

The Commit chain section describes the review pass. Add the convention: the first pass takes the pull request base, and each later pass takes the previous reviewed head as `baseSha`, so it reviews the increment. State the ceiling in one line, that the guard can't walk the chain, and point at the record.

- [ ] **Step 4: Verify and commit**

Verify: the commit passes lefthook without bypass.

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

Cover the three-tier enforcement stack and why the edit-time tier is probabilistic rather than deterministic. Cover the tool reversal. The rollout note named the predecessor, its maintainer steers new projects away from it, and its single-project-root state storage collides with parallel worktree clusters. Cover the pinned dependency over the plugin, the allow-list scope, and the editing-tools-only matcher with the shell path named as the upgrade. Cover the incremental review convention with its chain ceiling. Record the deliberate test gap: one deterministic spec covers the formatter hook, and the gate's own behavior stays a recorded arming probe. Don't cite the compliance figure from the frozen design note, because the research pass found no primary source for it. Full prose, clean under both prose gates.

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
