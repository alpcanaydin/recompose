# Tdd-guard-hook design

## Header and change linkage

- Change id: tdd-guard-hook
- Schema: recompose
- Proposal: [proposal.md](proposal.md)
- Specs: [specs/development-process/spec.md](specs/development-process/spec.md)
- Discovery: None
- Tasks: [tasks.md](tasks.md)

## Context

Test-first discipline reaches the pipeline through three channels today. The implementation reference asks each task to capture a failing run before the code exists. The task report carries that capture, and a reviewer reads it once the branch lands. Both channels sit downstream of the moment the rule breaks, which is the edit itself. A reviewer holding a finished branch has no way to separate a captured red run from one written after the fact.

The pipeline already runs deterministic gates at the pull request: mutation, coverage, and the blast-radius path guard. None of them fire while a subagent writes code. The tool boundary is the one place that sees the edit before it lands, and Claude Code exposes it through `PreToolUse` hooks.

Two defects in the surrounding tooling sit in the way. The `PostToolUse` formatter hook fails a script edit under `.claude`, which is where this change writes. The `feature-cycle/reviewed` status binds to one commit, so each fix push pays for a whole-branch review again.

## Discovery inputs consumed

- Formatter hook reproduction: the reported cause was wrong, so the fix changed shape. `oxfmt` holds `.claude/**` in its ignore list and leaves the file byte-identical, even with an absolute path. `oxlint` carries the same ignore entry and exits 1 with `No files found to lint`, which the hook reads as a lint failure and turns into `exit 2`. The fix became the `--no-error-on-unmatched-pattern` flag that lefthook already passes.
- Hook extension audit: the hook's pattern list covers `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, and `.cjs`, and skips `.mts`. Under `.claude` that leaves one file affected today, the saved workflow script, and every saved workflow the rollout adds later. The scope claim shrank to match, and the spec's ignored-path case uses a matching extension so the case exercises the branch it targets.
- Subagent hook probe: a subagent's `Write` call hit the existing `PreToolUse` hook and never reached disk. Hooks cover subagent tool calls, so the gate reaches the executor's implementers rather than the orchestrating session alone. Without that result this change would guard the wrong surface.
- Vitest reporter probe: a root-level reporter in a config that declares a `projects` array received modules from every project. One registration in `apps/desktop/vitest.config.ts` covers the unit, browser, and Storybook projects.
- Registry metadata: `tdd-guard` sits at 1.7.0 and `tdd-guard-vitest` at 0.2.0 with a `vitest >=3.2.4` peer range, which the repository's 4.1.10 satisfies. The command carries `@anthropic-ai/claude-agent-sdk`, which confirms model-backed validation rather than a deterministic rule engine.
- Upstream plugin manifest: the plugin's hooks run `npx tdd-guard@latest` on `PreToolUse`, `UserPromptSubmit`, and `SessionStart`. The maintainer names the plugin the supported path and calls manual wiring prone to silent failure. Decision 1 records the trade.
- Upstream ignore-pattern reference: a custom list replaces the defaults outright, so the committed configuration restates every default it keeps.
- Architecture Decision Record (ADR) 0039 trust model: the review marker protects against drift, not against an adversary. That framing lets the incremental convention land as a documented ceiling instead of new machinery.

## Goals and non-goals

**Goals:**

- Block an implementation edit that no failing test precedes, in the orchestrating session and in every subagent alike.
- Hold each edit-time gate inside a declared scope, so documents, specifications, configuration, and tooling stay editable.
- Restore normal edits under `.claude`.
- Cut the cost of the heavy review pass after a fix push.

**Non-goals:**

- No deterministic replacement for the model-backed validation. The gate stays a heuristic tier above the deterministic gates, never a substitute for them.
- No chain verification for the review marker. Decision 5 records the ceiling.
- No defense against a determined bypass. A subagent that writes through a shell command still evades the hook, and the upstream shell denial list would break this repository's own tooling.
- No continuous integration counterpart. Hooks run on the local machine, and the pull request tier already owns the remote side.
- No change to the mutation gate, the coverage gate, or the path guard's blast-radius set.

## Constraints and invariants

- "Never write code comments." Code explains itself through naming and structure. The sole exception is a constraint the code can't express.
- Maximum TypeScript strictness: `strict` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, and `noPropertyAccessFromIndexSignature`. No `any`, no `as` casts to silence errors, and no unexplained suppression comments.
- "`main` stays protected. Never commit to it, locally or remotely."
- Never use an em dash in authored prose.
- Every task captures its failing run in the task report and lands as one green commit. No commit records a failing state.
- Tooling scripts under `.claude/workflows/` are `.mts` with erasable-only syntax, wired into the typecheck chain. Saved workflow scripts at the top of that tree stay `.js`.
- No committed artifact carries a machine-specific absolute path or the maintainer's account name.

## Design

The change adds the missing tier to a stack that already has two. Edit-time enforcement fires at the tool boundary and blocks before the code exists. The task report holds the captured red run for the reviewer. The pull request runs the deterministic gates. Each tier catches what the tier below it misses, and none of them replaces another.

**Installation.** The upstream plugin supplies the hooks. Two entries in `.claude/settings.json` carry it: a marketplace entry pointing at the upstream repository, and an enabled-plugin entry. Five plugins already reach the repository this way, so the shape matches the file's existing content. The plugin's hooks invoke the command through `npx`, which resolves the newest release on each run. Decision 1 records that cost, and the risk section names its containment.

**Test state.** The gate reads what the test runner reports, never a claim in a prompt. The `tdd-guard-vitest` reporter writes the latest run into the guard's data directory. Both vitest configurations register it at the root of the `test` block, where a reporter sees every project. Each configuration passes a `projectRoot` computed from `import.meta.url`, because the repository root holds the data directory and no committed file may carry an absolute machine path.

**Scope.** The guard matches a deny list, and a custom list replaces the defaults outright. The committed configuration therefore restates the default document and configuration extensions. It then adds the trees this repository keeps outside the inner test-driven loop: tooling under `.claude`, configuration modules, Storybook stories, the Storybook configuration, and the end-to-end tree. That leaves `apps/desktop/src` and `packages/contracts/src` guarded, which is where the inner loop runs. The path base that the matcher applies is an upstream detail. The implementing task settles it against the running guard rather than against the documentation.

**State on disk.** The guard's data directory holds both the committed configuration and the transient run state. The ignore rule excludes the directory and re-admits the single configuration file, so the shared contract stays in version control and the machine-local state stays out.

**Formatter hook.** The hook keeps its shape and gains the flag that turns an out-of-scope path from a failure into a no-op. A behavior spec runs the configured command against sample payloads and asserts the outcome, which also catches a future hook-contract drift.

**Incremental review.** The `review-pr` workflow already takes `baseSha` as a free parameter. The first pass covers the whole branch, and each later pass takes the previous reviewed head as its base. The convention needs no code, and it lands in the verification reference and the living contract.

## Data model and contracts

The guard's configuration file is the one contract this change introduces.

```json
{
  "guardEnabled": true,
  "ignorePatterns": ["<glob>", "..."]
}
```

- `guardEnabled`: a boolean the session toggle flips. The committed value is `true`.
- `ignorePatterns`: a minimatch glob list. The list replaces the upstream defaults rather than extending them.

The reporter contract is a positional option object on the vitest reporter entry, carrying `projectRoot` as an absolute path resolved at configuration load.

## Error handling

- **Edit with no failing test.** The hook denies the tool call and returns the reason to the caller. The subagent writes the test first and retries.
- **Empty or stale test state.** The guard has no run to read, so it treats the edit as unproven and denies it. The recovery is a test run, and the session toggle covers the case where a run isn't possible.
- **Out-of-scope path.** The guard skips validation and the edit proceeds. Silence here is the correct outcome, not a swallowed failure.
- **Command resolution failure.** A missing network or registry leaves `npx` unable to resolve the command. The hook fails and the edit stops, which is a loud failure rather than a silent bypass. The risk section names the containment.
- **Formatter hook on an out-of-scope path.** With the flag in place the linter reports success and writes nothing, so the hook returns 0 and the edit stands.

## File map

- `.claude/settings.json`: adds the marketplace and enabled-plugin entries, and adds the flag to the formatter hook (modify)
- `.claude/tdd-guard/data/config.json`: the committed guard scope (create)
- `.claude/workflows/hooks/hook-scope.test.mts`: the behavior spec for the formatter hook's scope invariant (create)
- `.gitignore`: excludes the guard's transient state and re-admits the configuration (modify)
- `apps/desktop/vitest.config.ts`: registers the reporter with a computed project root (modify)
- `apps/desktop/package.json`: adds the reporter dependency (modify)
- `packages/contracts/vitest.config.ts`: registers the reporter with a computed project root (modify)
- `packages/contracts/package.json`: adds the reporter dependency (modify)
- `package.json`: widens the workflow test glob to reach the new spec directory (modify)
- `.claude/skills/feature-cycle/references/implementation.md`: replaces the deferred gate language with the shipped mechanism (modify)
- `.claude/skills/feature-cycle/references/verification.md`: adds the incremental re-review convention (modify)
- `.claude/skills/feature-cycle/SKILL.md`: moves the gate out of the deferred rollout list (modify)
- `docs/adr/0040-edit-time-test-first-gate.md`: the process record (create)
- `docs/adr/README.md`: the index row (modify)
- `cspell-words.txt`: new vocabulary from this change (modify)

## Interfaces

- Consumes: the Claude Code `PreToolUse` hook contract, the vitest `reporters` array contract, the `feature-cycle/reviewed` commit status from `review-pr`, and the `baseSha` argument that workflow already accepts.
- Produces: `.claude/tdd-guard/data/config.json` as the committed scope contract, and the `test:workflows` script as the runner that reaches the new spec.

## Decisions

### 1. The upstream plugin carries the hooks

The maintainer names the plugin the supported installation and documents manual wiring as prone to silent breakage across Claude Code versions. Five plugins already reach this repository through the same two settings entries, so the shape introduces nothing new. The cost is real: the plugin's hooks run `npx tdd-guard@latest`, so an unpinned third-party command executes on every edit, every prompt, and every session start. That sits against the repository's pinning posture. The maintainer accepted the trade for upstream compatibility, and the record states it plainly.

**Alternatives considered:** a pinned devDependency with a hand-written hook command. Upstream calls that path fragile, and the version drift it prevents costs less than a hook that fails without a signal.

**Record draft:** `docs/adr/0040-edit-time-test-first-gate.md`

### 2. The guard covers the source trees alone

The inner test-driven loop runs in `apps/desktop/src` and `packages/contracts/src`. Configuration modules, Storybook stories, the end-to-end tree, and the tooling under `.claude` follow other rhythms, and guarding them would produce blocks the rule never intended. Narrow scope also caps the cost, because each in-scope edit spends a model call.

**Alternatives considered:** the upstream defaults alone, rejected because they leave configuration modules and tooling guarded. Adding stories and end-to-end files, rejected because the outer behavior loop doesn't share the inner loop's red-green rhythm.

### 3. The project root resolves at load time

Each vitest configuration computes the repository root from `import.meta.url` instead of carrying a literal path. The documentation shows an absolute example, which would embed a machine path and an account name in a committed file.

**Alternatives considered:** a literal absolute path, rejected outright. An environment variable, rejected because it moves shared configuration out of version control.

### 4. The formatter hook takes a flag, not a path list

The linter already offers `--no-error-on-unmatched-pattern`, and lefthook already passes it for the same reason. A hand-maintained exclusion list inside the hook would restate the linter's ignore configuration and drift from it.

**Alternatives considered:** a `case` arm excluding `.claude`, rejected as a second copy of an ignore list that already exists. Treating the linter's exit code as advisory, rejected because it would hide real lint failures.

### 5. The incremental convention stays a convention

The heavy pass gets a smaller base on each later run, which cuts the cost the maintainer raised. The guard can't verify that the chain of reviewed ranges covers the branch, so the marker attests less than its name suggests. Record 0039 already scopes the marker to drift protection rather than adversarial security, and this ceiling sits inside that scope. The record names the upgrade path: the workflow writes the reviewed range into the status description, and the guard walks one link of the chain.

**Alternatives considered:** chain verification now, deferred because the convention alone solves the cost problem the maintainer named. Whole-branch review on every push, rejected because the cost is what prompted the work.

### 6. One deterministic spec, and an honest gap

The formatter hook's command lives in a settings file this change owns, so a spec can run it against sample payloads and assert the outcome. The guard's own scope lives in a third-party matcher, so a spec over the pattern list would re-implement that matcher and prove nothing about the guard. The scope check stays a recorded manual smoke step instead of a test that can't fail for a real reason.

**Alternatives considered:** a pattern-matching spec over the configuration, rejected as tautological. No spec at all, rejected because a broken hook that gave no signal has already cost this repository a defect.

## Test matrix

| Layer          | What this layer proves (or why none)                                                                                                                   | Check command             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| Unit           | The configured formatter hook returns success for a path outside the linter's scope and failure for a real lint error                                  | `pnpm run test:workflows` |
| Integration    | None. The guard's own decision path runs a third-party command against a model, so an automated run would spend a model call and return a soft verdict | none                      |
| End-to-end     | None. No user-facing behavior changes, and the pipeline surface has no scenario                                                                        | none                      |
| Property       | None. The hook decision has no invariant over a generated input space that the three-case spec misses                                                  | none                      |
| Mutation scope | None. The mutation runner covers the application packages, and `.claude` stays outside its scope, matching the precedent the path guard set            | none                      |

## Task decomposition hooks

- Task 1: Restore edits under `.claude` (depends on: none, hands off: a working edit path for every later task, plus the spec directory the test script reaches)
- Task 2: Wire the reporter and the guard scope (depends on: Task 1, hands off: the committed scope contract and the reporter registration)
- Task 3: Install the plugin and confirm the gate (depends on: Task 2, hands off: the settings entries and the smoke evidence)
- Task 4: Fold the mechanism into the skill (depends on: Task 3, hands off: the shipped-gate language and the incremental convention)
- Task 5: Process record (depends on: Task 4, hands off: the record every later reader cites)
- Task 6: Verification and pull request (depends on: Task 5, hands off: the pushed branch and the review status)

## Risks

- [Risk] The plugin resolves `tdd-guard@latest` on every hook fire, so an upstream release changes behavior with no review → Mitigation: the record names the exposure, the guard holds no write access to the repository, and the deterministic gates stay the merge blockers, so a bad release costs friction rather than a bad merge.
- [Risk] A model call on every in-scope edit adds latency and cost → Mitigation: scope narrows the gate to two source trees, and the session toggle covers a burst of out-of-loop work.
- [Risk] Stale test state denies a legitimate edit → Mitigation: the recovery is a test run, and the toggle covers the rest. The smoke step in Task 3 exercises the case.
- [Risk] The ignore matcher's path base differs from the documented examples, so the scope widens with no signal → Mitigation: Task 2 settles the base against the running guard and records the evidence, rather than trusting the documentation.
- [Risk] The reporter's dependency looks unused to the dead-code gate, because a reporter entry is a string → Mitigation: Task 2 runs the gate and records the dependency as ignored when the gate flags it.
- [Risk] The incremental convention lets a reviewed range skip commits → Mitigation: the record names the ceiling and its upgrade path, inside the drift-protection model record 0039 already set.

## Migration and rollout

The plugin install is a maintainer action, because a marketplace command needs the interactive session. Task 3 prepares the two commands and the maintainer runs them, which writes the settings entries the same task commits. The reporter and the scope configuration land before the plugin, so the first guarded edit reads real test state instead of an empty directory. Rollback is the reverse: remove the two settings entries and the guard stops firing, leaving the reporter as a harmless extra entry.

## Open questions

None.

## End-to-end verification

Run the desktop suite so the reporter writes a fresh state. Edit a file under `apps/desktop/src` with no failing test behind it and confirm the tool call comes back denied with the reason. Write a failing test, run the suite, repeat the edit, and confirm it proceeds. Edit a markdown file and a file under `.claude` and confirm neither gate interferes. A fresh-context reviewer then diffs the result against three criteria. The committed scope matches Decision 2. No committed file carries an absolute machine path. The `test:workflows` script covers the formatter hook's scope invariant.
