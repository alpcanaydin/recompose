# Edit-time-test-first-gate tasks

> For agentic workers: use `superpowers:subagent-driven-development` to execute task by task. Every commit passes lefthook without bypass. Global constraints: never commit to `main`, no code comments, no em dash in prose, commit style `<type>: <imperative subject>` with at most 50 characters, and one green commit per task. Never commit a failing state: write the failing spec, run it, paste the full red output into the task report, then implement to green and commit once. Every dependency pins to an exact version. No committed file carries an absolute machine path.

## Task 1: Restore edits under `.claude`

**Files:**

- Create: `.claude/workflows/hooks/hook-scope.test.mts`
- Modify: `.claude/settings.json`, `package.json`

**Interfaces:**

- Consumes: the `PostToolUse` hook command already configured for `Edit|Write`.
- Produces: a working edit path under `.claude` that every later task depends on, and the spec directory the `test:workflows` script reaches.

- [x] **Step 1: Write the failing spec and capture its red run**

The hook exits 2 for a script edit under `.claude`, because `.claude/**` sits in the linter's ignore list and the linter answers an ignored path with exit 1 and `No files found to lint`. The hook reads that as a lint failure. Its pattern list covers `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, and `.cjs`, and skips `.mts`, so `.claude/workflows/review-pr.js` is the file affected today.

Three cases. An ignored path whose extension the hook does match exits 0. A clean linted source file exits 0. A source file with a real lint error exits 2.

- [x] **Step 2: Apply the flag and land one green commit**

Add `--no-error-on-unmatched-pattern` to both the formatter and the linter invocation inside the `PostToolUse` command.

## Task 2: Pin the gate and declare its scope

**Files:**

- Create: `probity.config.ts`
- Modify: `package.json`, `knip.json`

**Interfaces:**

- Consumes: the working edit path from Task 1.
- Produces: the pinned binary and the committed scope contract that Task 4 arms.

> Read the upstream reference before writing anything, because this project ships weekly and memory is stale. Fetch `https://raw.githubusercontent.com/nizos/probity/main/docs/configuration.md` and `https://raw.githubusercontent.com/nizos/probity/main/docs/rules.md`, and follow their current shape rather than any example in this file.

- [ ] **Step 1: Pin the dependency and confirm the binary resolves**

Add `@nizos/probity` at exactly `1.10.0` to the root `package.json` dev dependencies. It's a command a hook runs, not a module any package imports, so it belongs at the root and nowhere else. Install through `pnpm add --save-dev --save-exact --workspace-root`, never by editing the lockfile, which a hook blocks.

The package declares peer dependencies on several syntax-tree language packs this repository has no use for. Don't add them. If the install demands them, reach for the workspace's peer-dependency ignore mechanism rather than pulling four unused native packages into the lockfile.

Verify: `./node_modules/.bin/probity --help` resolves and prints usage. Record that output in the report, with the flag that selects Claude Code as the host, because Task 4 needs the exact command.

- [ ] **Step 2: Write the scope contract**

Create `probity.config.ts` at the repository root, following the upstream flat shape. Bind the test-first rule to the source trees alone:

- Guarded: `apps/desktop/src` and `packages/contracts/src`.
- Outside every rule: test files, type-level specs, stories, generated modules, configuration modules, the end-to-end tree, the Storybook configuration, and everything under `.claude`.

Writing a test must never trip the rule that demands one. Confirm against the upstream reference how the tool classifies a test file. State in the report which mechanism handles it: a built-in classification, or an explicit exclusion you wrote.

Globs resolve against this file's own directory. Never write an absolute path.

- [ ] **Step 3: Clear the gates and commit**

Nothing imports the binary, so the dead-code gate will flag it. Run `pnpm run lint:dead` and record it in the root workspace's `ignoreDependencies`. Add any new vocabulary to `cspell-words.txt`. Keep `probity.config.ts` under the repository's strict settings with no comments, because the typecheck and lint gates cover the repository root.

Verify: the commit passes lefthook without bypass, and `pnpm run typecheck` exits 0.

```bash
git add package.json pnpm-lock.yaml pnpm-workspace.yaml probity.config.ts knip.json cspell-words.txt
git commit -m "build: pin the probity gate and its scope"
```

## Task 3: Build the transcript resolver

**Files:**

- Create: `.claude/workflows/hooks/resolve-transcript.mts`, `.claude/workflows/hooks/resolve-transcript.test.mts`

**Interfaces:**

- Consumes: the `PreToolUse` payload on standard input, and the pinned binary from Task 2.
- Produces: the command Task 4 puts in the hook entry.

Background, already measured, so use it rather than deriving it again. A subagent's `PreToolUse` payload carries the PARENT session's transcript path, byte-identical to the main loop's. The payload also carries `agent_id` and `agent_type`. The subagent's own record sits at the transcript path with the `.jsonl` extension stripped, followed by `/subagents/agent-<agent id>.jsonl`. A live probe confirmed it. The derived file existed and held exactly that subagent's single write. Without the rewrite the gate reads a record holding none of the acting subagent's work, so it denies every implementer edit.

- [ ] **Step 1: Write the failing spec and capture its red run**

Colocate `resolve-transcript.test.mts` next to the script, in the style of `.claude/workflows/path-guard/path-guard.test.mts`: `node:test`, `node:assert/strict`, behavior names in domain language, no comments.

The spec drives one exported pure function that takes the parsed payload and a record-exists predicate, then returns the transcript path to use. Inject the predicate so the spec never touches the filesystem, which is this repository's rule for doubles at a process boundary.

Three cases:

1. A payload with no subagent identity returns the payload's own transcript path.
2. A payload naming a subagent, whose derived record exists, returns the derived path.
3. A payload naming a subagent, whose derived record is missing, returns the payload's own transcript path.

Run `pnpm run test:workflows` and paste the full failing output into the task report.

- [ ] **Step 2: Implement to green and land one commit**

Keep the script self-contained, matching how `path-guard.mts` exports its pure decision and calls it from a thin main. The main path reads the payload from standard input and resolves the transcript path. It writes the payload back out with that path substituted and runs the gate with it on standard input. It then forwards the gate's standard output, standard error, and exit status without alteration. Standard output is the load-bearing channel: this gate answers every processed payload with exit status 0 and expresses a denial as a structured decision on standard output. Capturing that stream instead of passing it through turns the gate off while every check stays green, so treat the exit status as necessary but never sufficient.

A payload that fails to parse isn't a reason to swallow the gate. Decide the behavior, state it in the report, and make it visible rather than silent.

Verify: `pnpm run test:workflows` passes every case, and `pnpm run typecheck:workflows` exits 0.

```bash
git add .claude/workflows/hooks/
git commit -m "feat: resolve the subagent transcript for the gate"
```

## Task 4: Arm the gate and prove both directions

**Files:**

- Modify: `.claude/settings.json`, `probity.config.ts`

**Interfaces:**

- Consumes: the resolver command from Task 3 and the scope contract from Task 2.
- Produces: the armed hook and the probe evidence in the task report.

- [ ] **Step 1: Close the two scope holes the Task 2 review found**

The committed allow list names `.ts` and `.tsx`, so any other extension under a guarded tree arrives unguarded and no gate says so. This repository writes new scripts as `.mts`, so that hole is live. Widen the positive globs to the trees themselves and negate the non-source extensions instead. Second, `packages/contracts/src` names the only package that exists today. Use a pattern that covers the next one.

Prove the change rather than asserting it. Exercise the edited configuration through the tool's own loader over a path list, the way the Task 2 report did, and paste the table into your report. The list must include an `.mts` path under a guarded tree, a stylesheet, a package that doesn't exist yet, and one path from each existing negation.

- [ ] **Step 2: Arm the hook**

Add a `PreToolUse` entry matching the editing tools, running the resolver through `node`, the way the continuous integration job runs the path guard. Match the existing hooks' style in that file, and set an explicit timeout the way the other entries do. Don't match shell commands: Decision 6 in `design.md` states that boundary and its reason. Leave every existing hook untouched.

A hook entry loads at session start, so the maintainer restarts the session before the probe.

- [ ] **Step 3: Probe both directions and record the evidence**

A gate that blocks everything and a gate that blocks nothing both look quiet from the outside, so prove each direction and paste every outcome into the report:

1. From a subagent, edit a file under `apps/desktop/src` with no failing test in that subagent's session. The gate denies the call and gives a reason.
2. From the same subagent, write a failing test, run that package's suite, then repeat the edit. The gate lets it through. This is the case the resolver exists for, so it carries the most weight.

Read the verdict on standard output, never from the exit status. This gate returns 0 for both answers, so an exit-status comparison reports success in both directions and proves nothing. A denial arrives as a structured decision on standard output, and an allow arrives as empty standard output. 3. Edit a markdown file, a configuration module, and a file under `.claude`. No gate interferes, which also confirms Task 1 holds with both hooks armed. 4. Report which configuration file resolved during the probe. Discovery walks up from the working directory, so a worktree created before this change finds the parent checkout's configuration, whose globs anchor to the parent's trees. That binds the rule to the wrong tree and reports nothing. Name the resolved path and say whether it belonged to the worktree.

Revert any scratch edit the probe made.

- [ ] **Step 4: Commit**

Verify: the commit passes lefthook without bypass, and `pnpm run test:workflows` still passes with the new settings content.

```bash
git add .claude/settings.json probity.config.ts
git commit -m "build: arm the edit-time test-first gate"
```

## Task 5: Fold the mechanism into the skill

**Files:**

- Modify: `.claude/skills/feature-cycle/SKILL.md`, `.claude/skills/feature-cycle/references/implementation.md`, `.claude/skills/feature-cycle/references/verification.md`

**Interfaces:**

- Consumes: the armed gate from Task 4 and Decision 7 from `design.md`.

- [ ] **Step 1: Move the gate out of the deferred list**

The Enforcement rollout note in `SKILL.md` lists the gate among the deferred machinery. Move it to the shipped sentence and name where it lives: a pinned dependency, a resolver, a `PreToolUse` hook, and `probity.config.ts` for the scope.

- [ ] **Step 2: Make the mechanism concrete in the implementation reference**

The Red-run evidence section describes the gate in the abstract. Replace that with the mechanism. The gate reads the acting worker's own record, it covers subagent tool calls, and its scope is the source trees. It sits above the deterministic gates rather than replacing them. State the operational consequence for implementers: the failing test run must happen in the same session as the edit.

- [ ] **Step 3: Add the incremental convention to the verification reference**

The Commit chain section describes the review pass. Add the convention: the first pass takes the pull request base, and each later pass takes the previous reviewed head as `baseSha`, so it reviews the increment. State the ceiling in one line, that the guard can't walk the chain, and point at the record.

- [ ] **Step 4: Verify and commit**

Verify: the commit passes lefthook without bypass.

```bash
git add .claude/skills/feature-cycle/
git commit -m "docs: shipped tdd gate and incremental review"
```

## Task 6: Process record

**Files:**

- Create: `docs/adr/0040-edit-time-test-first-gate.md` (0039 is the last taken number)
- Modify: `docs/adr/README.md`

**Interfaces:**

- Consumes: every decision from `design.md` in this change.

- [ ] **Step 1: Write the record through the new-adr skill**

Cover the three-tier enforcement stack and why the edit-time tier is probabilistic rather than deterministic. Cover both tool evaluations. The rollout note named the predecessor, its maintainer steers new projects away from it, and its single-project-root state storage collides with parallel worktree clusters. Its successor carries no state, but the measurement showed a subagent's payload hands over the parent record, and the resolver is what closes that. Record the resolver's ceiling: the derived path is a convention the harness never documented, and the fallback plus the arming probe are the containment. Cover the pinned dependency over the plugin, the allow-list scope, and the editing-tools-only matcher with the shell path named as the upgrade. Cover the incremental review convention with its chain ceiling. Record the deliberate test gap: deterministic specs cover the resolver and the formatter hook, and the gate's own verdict stays a recorded arming probe. Don't cite the compliance figure from the frozen design note, because the research pass found no primary source for it.

- [ ] **Step 2: Update the index**

Add the row to `docs/adr/README.md` in the existing format.

- [ ] **Step 3: Verify and commit**

Verify: the commit passes lefthook without bypass.

```bash
git add docs/adr/ cspell-words.txt
git commit -m "docs: adr for the edit-time test gate"
```

## Task 7: Verification and pull request

**Files:** none (process step).

- [ ] **Step 1: Rules review and full gate sweep**

Run a `rules-reviewer` pass over the branch diff and fix its findings in the worktree. Then run `pnpm run lint:openspec`, `pnpm run lint:prose`, `pnpm run lint:spell`, `pnpm run typecheck`, `pnpm run test`, and `pnpm run test:workflows`. All exit 0.

- [ ] **Step 2: Push, review, then open**

Push the branch. Run `/review-pr` on the pushed head with `sha`, `repo`, and `baseSha`. This change touches the settings file, the package manifests, and the workflow tree, so the path guard demands the review status. Fix any surviving finding, push again, and re-review with the previous reviewed head as `baseSha`. Prepare the `gh pr create` command for the maintainer with a body naming the change directory, the modified capability, and the record.
