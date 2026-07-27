# Edit-time-test-first-gate design

## Header and change linkage

- Change id: edit-time-test-first-gate
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

- Tool selection reversed on primary evidence. The change opened against `tdd-guard`, the tool the rollout note named. Its README now carries this banner:

  ```text
  IMPORTANT
  TDD Guard grew into Probity: the same TDD enforcement, now for Claude Code,
  Codex, and GitHub Copilot CLI, with more reliable validation and no test
  reporters to set up. New projects should start there. TDD Guard remains
  maintained for the projects that rely on it.
  ```

  That banner alone moved the tool choice, and Decision 1 records the rest of the case.

- Storage audit of the rejected tool, confirmed against its source: fixed filenames in one project-root data directory, plain unlocked writes, and no session or subagent component in the path. The pipeline runs many implementers in separate worktrees at once, so one cluster's test state would answer for another's. That mismatch is disqualifying rather than inconvenient.
- Probity architecture, confirmed against its own decision record: "Host coding agents already write a session transcript to disk; Probity reads it and carries no session state." No storage directory, no socket, no lock file, and no reporter. That removes the predecessor's failure mode, and an early reading treated it as proof that concurrent worktrees are safe. That reading was wrong, and the next two entries record why.
- Reader audit: `src/vendors/claude-code/transcript.ts` parses each entry against a schema of `{type, message.content}` alone. It never reads a working directory, a session identifier, or a subagent identifier, so it holds no field that separates one work stream from another inside whatever record it gets handed.
- Live measurement, and the one that settled the design. A payload-logging `PreToolUse` hook captured one main-loop write and one subagent write. The `transcript_path` was byte-identical for both: the parent session's record. The payload does carry `agent_id` and `agent_type`. A gate reading the parent record would judge an implementer against a record that holds none of that implementer's work, so it would deny every implementer edit.
- Derivation check: the per-subagent record exists at the payload's transcript path with its extension stripped, followed by `subagents/agent-<agent id>.jsonl`. Confirmed against the probe's own identifiers, and the file held exactly that subagent's single write. The gap is which record reaches the gate, not whether the record exists, which is what makes a small resolver enough.
- Probity scoping model: an allow list shaped like a flat lint configuration, with `files` globs anchored to the configuration file's directory and discovery walking up from the working directory. The rejected tool offered a deny list alone, which produced a trap this change already hit: a pattern covering `.claude` also covers `.claude/worktrees`, so the gate went inert for every worktree it targets. An allow list removes the trap outright.
- Registry metadata: `@nizos/probity` sits at 1.10.0, published 2026-07-08, permissively licensed, Node 22 or newer, with a `probity` binary. Sixteen releases in three months, and the repository took a push the day this change opened.
- Rule audit: four of the five built-in rules evaluate in code. The test-first rule makes a model call per matching edit through the vendor software development kit, with an opt-in syntax-tree fast path for a single added test. Decision 4 places that call in the tier stack.
- Formatter hook reproduction: the reported cause was wrong, so the fix changed shape. `oxfmt` holds `.claude/**` in its ignore list and leaves the file byte-identical, even with an absolute path. `oxlint` carries the same ignore entry and exits 1 with `No files found to lint`, which the hook reads as a lint failure and turns into `exit 2`. The fix became the `--no-error-on-unmatched-pattern` flag that lefthook already passes.
- Hook extension audit: the formatter hook's pattern list covers `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, and `.cjs`, and skips `.mts`. Under `.claude` that leaves one file affected today, the saved workflow script, and every saved workflow the rollout adds later.
- Subagent hook probe: a subagent's `Write` call hit the existing `PreToolUse` hook and never reached disk. Hooks cover subagent tool calls, so the gate reaches the executor's implementers rather than the orchestrating session alone. Without that result this change would guard the wrong surface.
- Architecture Decision Record (ADR) 0039 trust model: the review marker protects against drift, not against an adversary. That framing lets the incremental convention land as a documented ceiling instead of new machinery, and it also sets the honest bar for this gate.
- Sourcing check: the compliance figure cited at line 22 of the frozen feature-cycle design note has no locatable primary source. The record avoids it and argues from the mechanism instead.

## Goals and non-goals

**Goals:**

- Block an implementation edit that no failing test precedes, in the orchestrating session and in every subagent alike.
- Keep the decision correct when many clusters run at once, each in its own worktree.
- Hold each edit-time gate inside a declared scope, so documents, specifications, configuration, and tooling stay editable.
- Restore normal edits under `.claude`.
- Cut the cost of the heavy review pass after a fix push.

**Non-goals:**

- No deterministic replacement for the model-backed test-first rule. The gate stays a probabilistic tier above the deterministic gates, never a substitute for them.
- No coverage of shell-driven writes in this change. Decision 6 records that boundary and its reason.
- No chain verification for the review marker. Decision 7 records the ceiling.
- No defense against a determined bypass. The trust model is drift protection.
- No continuous integration counterpart. Hooks run on the local machine, and the pull request tier already owns the remote side.
- No change to the mutation gate, the coverage gate, or the path guard's blast-radius set.

## Constraints and invariants

- "Never write code comments." Code explains itself through naming and structure. The sole exception is a constraint the code can't express.
- Maximum TypeScript strictness: `strict` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, and `noPropertyAccessFromIndexSignature`. No `any`, no `as` casts to silence errors, and no unexplained suppression comments.
- "`main` stays protected. Never commit to it, locally or remotely."
- Never use an em dash in authored prose.
- Every task captures its failing run in the task report and lands as one green commit. No commit records a failing state.
- Every dependency pins to an exact version. No unpinned command runs in a hot path.
- Prohibition rules belong in deterministic gates, not in prompts to a model.
- No committed artifact carries a machine-specific absolute path or the maintainer's account name.

## Design

The change adds the missing tier to a stack that already has two. Edit-time enforcement fires at the tool boundary and blocks before the code exists. The task report holds the captured red run for the reviewer. The pull request runs the deterministic gates. Each tier catches what the tier below it misses, and none of them replaces another.

**Installation.** `@nizos/probity` pins exact as a root development dependency, and the hook command runs the workspace binary at `./node_modules/.bin/probity`, matching how the existing formatter hook calls its tools. The version lands in the lockfile, Renovate tracks it, and no hook fire reaches the network. The upstream plugin exists and installs in two commands, but its hook runs the package unpinned, which sits against this repository's pinning posture.

**How the decision gets made.** Claude Code hands each `PreToolUse` call the path of a transcript. The gate parses it, reconstructs the recorded tool calls and their results, and learns from them whether the caller ran its tests and what came back. Nothing writes shared state, so no two callers corrupt each other.

**The resolver.** The payload names the parent session's transcript even when a subagent makes the call. The gate would then read a record holding none of that subagent's work. A resolver sits between the hook and the gate and fixes the input. It reads the payload, and when `agent_id` is present it derives that subagent's own record by stripping the extension from the transcript path and appending `subagents/agent-<agent id>.jsonl`. It rewrites the payload's transcript path only when that file exists, and otherwise passes the payload through unchanged. It then runs the gate on the result and forwards the gate's output and exit status untouched.

Two properties make this safe to depend on. The derivation is a pure function over the payload plus one existence check, so a specification covers every branch. The fallback keeps a harness that stops writing per-subagent records from breaking the gate: it degrades to today's behavior, and the arming probe detects it.

**Scope.** The configuration lives at `probity.config.ts` in the repository root and declares an allow list: the test-first rule binds to the source trees, `apps/desktop/src` and `packages/contracts/src`, where the inner loop runs. Everything outside them faces no rule at all. Test files, type-level specs, stories, generated modules, and configuration modules stay outside the rule, so writing a test never trips the gate that demands one. Globs resolve against the configuration file's directory, and every worktree carries its own copy of that file, so a worktree resolves to itself with no absolute path anywhere.

**Formatter hook.** The hook keeps its shape and gains the flag that turns an out-of-scope path from a failure into a no-op. A behavior spec runs the configured command against sample payloads and asserts the outcome, which also catches a future hook-contract drift.

**Incremental review.** The `review-pr` workflow already takes `baseSha` as a free parameter. The first pass covers the whole branch, and each later pass takes the previous reviewed head as its base. The convention needs no code, and it lands in the verification reference and the living contract.

## Data model and contracts

The gate configuration is the one contract this change introduces. It follows the upstream flat shape, an array of blocks that each bind rules to a set of files:

```ts
export default [{ files: ['<glob>'], rules: {/* rule entries */} }];
```

- `files`: globs resolved against the directory holding this file, never absolute.
- `rules`: the rule entries that apply to those files, with the test-first rule carrying its own options.

The exact rule names and option keys come from the upstream reference at implementation time rather than from memory, because the project ships weekly.

## Error handling

- **Edit with no failing test.** The hook denies the tool call and returns the reason to the caller. The subagent writes the test first and retries.
- **No test run in the transcript.** The gate has nothing to read, so it treats the edit as unproven and denies it. The recovery is a test run inside the same session.
- **Out-of-scope path.** No rule binds, so the edit proceeds. Silence here is the correct outcome, not a swallowed failure.
- **Validation failure.** A model or configuration error leaves the gate unable to rule, and it fails closed. A closed failure stops work in the open instead of passing an unproven edit, and the arming probe in Task 4 makes both broken states visible.
- **Formatter hook on an out-of-scope path.** With the flag in place the linter reports success and writes nothing, so the hook returns 0 and the edit stands.

## File map

- `.claude/settings.json`: adds the gate hook, and adds the flag to the formatter hook (modify)
- `probity.config.ts`: the guarded scope as an allow list (create)
- `.claude/workflows/hooks/resolve-transcript.mts`: the pure derivation plus the pipe that runs the gate (create)
- `.claude/workflows/hooks/resolve-transcript.test.mts`: the specification for the derivation's three branches (create)
- `.claude/workflows/hooks/hook-scope.test.mts`: the behavior spec for the formatter hook's scope invariant (create)
- `package.json`: pins the gate dependency and widens the workflow test glob (modify)
- `knip.json`: records the gate binary as a dependency no module imports (modify)
- `.claude/skills/feature-cycle/references/implementation.md`: replaces the deferred gate language with the shipped mechanism (modify)
- `.claude/skills/feature-cycle/references/verification.md`: adds the incremental re-review convention (modify)
- `.claude/skills/feature-cycle/SKILL.md`: moves the gate out of the deferred rollout list (modify)
- `docs/adr/0040-edit-time-test-first-gate.md`: the process record (create)
- `docs/adr/README.md`: the index row (modify)
- `cspell-words.txt`: new vocabulary from this change (modify)

## Interfaces

- Consumes: the Claude Code `PreToolUse` hook contract and its transcript path, the upstream flat configuration shape, the `feature-cycle/reviewed` commit status from `review-pr`, and the `baseSha` argument that workflow already accepts.
- Produces: `probity.config.ts` as the committed scope contract, and the `test:workflows` script as the runner that reaches the new spec.

## Decisions

### 1. Probity replaces the tool the rollout note named

The rollout note named `tdd-guard`, and verification turned that choice over. Its README steers new projects to Probity. Its storage keeps test state in fixed filenames under one project root, with unlocked writes and no session or subagent key. This pipeline runs many implementers in separate worktrees at once, so that storage model lets one cluster's state answer for another's, and no configuration fixes it. Probity carries no state, which removes that failure outright. It doesn't by itself solve the concurrent case, as the measurement in the discovery inputs shows, but the remaining gap is one resolvable input rather than a storage design. Decision 9 covers that. The scoping model settles the rest. An allow list expresses "guard the source trees" directly. A deny list produced a live trap, where excluding `.claude` also excluded every worktree beneath it.

**Alternatives considered:** staying on `tdd-guard`, rejected on the concurrency mismatch and the upstream steer. Deferring the gate entirely, rejected because the maintained replacement removes the objections that would have justified waiting.

**Record draft:** `docs/adr/0040-edit-time-test-first-gate.md`

### 2. A pinned dependency, not the plugin

The gate pins exact in the manifest and runs from the workspace, so the lockfile records it and Renovate updates it under review. The upstream plugin installs in two commands, and its hook runs the package unpinned on every matching tool call. A project shipping weekly releases would then change behavior inside a hot path with no review. Upstream documents the dependency shape as a first-class path, so this choice costs no support.

**Alternatives considered:** the plugin, rejected on pinning. Both together, rejected because a plugin update can restore its own hook definition and bring the unpinned command back with no signal.

### 3. The scope is an allow list over the source trees

The inner test-driven loop runs in `apps/desktop/src` and `packages/contracts/src`. Configuration modules, stories, the end-to-end tree, and the tooling under `.claude` follow other rhythms, and guarding them would produce blocks the rule never intended. An allow list also caps the cost, because each in-scope edit that misses the fast path spends a model call.

**Alternatives considered:** guarding everything and excluding by exception, rejected because the exception list is the failure mode the predecessor demonstrated.

### 4. The gate is a probabilistic tier, never the gate of record

The test-first rule asks a model to judge an edit. The project rules put prohibitions in deterministic gates, so this rule can't be the enforcing authority. It sits above patch coverage, the diff-scoped mutation run, and the adversarial review, which stay the merge blockers. The record states this plainly, so no later reader mistakes the gate for the proof.

**Alternatives considered:** treating the gate as authoritative, rejected against the project rule. Using the upstream free-text rule file to encode prohibitions, rejected as the same reviewer-prompt pattern the rules forbid.

### 5. The project root resolves from the configuration's own location

Globs resolve against the directory holding the configuration file, and every worktree carries its own committed copy. No absolute path appears anywhere, which the project rules require and which also makes each worktree resolve to itself.

**Alternatives considered:** an absolute root, rejected outright. An environment variable, rejected because it moves shared configuration out of version control.

### 6. The matcher covers editing tools, not shell commands

Upstream's matcher also covers shell commands, which closes the path where a subagent writes through a shell instead of an editor. This repository runs shell commands constantly, and putting a transcript parse in front of every one of them taxes work the rule has no interest in. The gate therefore binds to the editing tools, and the shell path stays open. That matches the stated trust model: drift protection, not an adversary. Widening the matcher is the named upgrade if drift shows up.

**Alternatives considered:** the upstream matcher verbatim, deferred on latency across a shell-heavy repository.

### 7. The incremental convention stays a convention

The heavy pass gets a smaller base on each later run, which cuts the cost the maintainer raised. The guard can't verify that the chain of reviewed ranges covers the branch, so the marker attests less than its name suggests. Record 0039 already scopes the marker to drift protection rather than adversarial security, and this ceiling sits inside that scope. The record names the upgrade path: the workflow writes the reviewed range into the status description, and the guard walks one link of the chain.

**Alternatives considered:** chain verification now, deferred because the convention alone solves the cost problem the maintainer named. Whole-branch review on every push, rejected because the cost is what prompted the work.

### 8. One deterministic spec, and an honest gap

The formatter hook's command lives in a settings file this change owns, so a spec can run it against sample payloads and assert the outcome. The gate's own decision runs a third-party binary against a model, so an automated spec over it would spend a model call and return a soft verdict. The gate's behavior stays a recorded arming probe instead of a test that can't fail for a real reason.

**Alternatives considered:** a glob-matching spec over the configuration, rejected as a re-implementation of the matcher that proves nothing about the gate. No spec at all, rejected because a broken hook that gave no signal has already cost this repository a defect.

### 9. A resolver hands the gate the right record

The payload names the parent session's transcript even for a subagent call. The gate would then read a record holding none of the acting subagent's work, and deny every implementer edit. The payload also carries the subagent's identity, and the per-subagent record sits at a path derived from the transcript path plus that identity. A resolver in front of the gate rewrites the path when the derived record exists and passes the payload through when it doesn't. Twelve lines of derivation buy the property the whole design rests on, and the fallback keeps a harness change from turning into an outage.

**Alternatives considered:** waiting for upstream to read the identity itself, rejected because that tracker never mentions subagents, and the pipeline needs the gate now. One top-level session per worktree, rejected because it replaces the executor's dispatch model to work around twelve lines. Running the clusters one at a time, rejected because it trades a contract the living specification already states for a probabilistic gate.

## Test matrix

| Layer          | What this layer proves (or why none)                                                                                                                                                                                                                                                              | Check command             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Unit           | The transcript derivation returns the subagent's record when it exists, the payload's own path when the payload names no subagent, and the payload's own path when the derived record is missing. The formatter hook returns success outside the linter's scope and failure for a real lint error | `pnpm run test:workflows` |
| Integration    | None. The gate's decision path runs a third-party binary against a model, so an automated run would spend a model call and return a soft verdict                                                                                                                                                  | none                      |
| End-to-end     | None. No user-facing behavior changes, and the pipeline surface has no scenario                                                                                                                                                                                                                   | none                      |
| Property       | None. The hook decision has no invariant over a generated input space that the three-case spec misses                                                                                                                                                                                             | none                      |
| Mutation scope | None. The mutation runner covers the application packages, and `.claude` stays outside its scope, matching the precedent the path guard set                                                                                                                                                       | none                      |

## Task decomposition hooks

- Task 1: Restore edits under `.claude` (depends on: none, hands off: a working edit path for every later task, plus the spec directory the test script reaches)
- Task 2: Pin the gate and declare its scope (depends on: Task 1, hands off: the dependency and the committed scope contract)
- Task 3: Build the transcript resolver (depends on: Task 2, hands off: the command the hook entry runs)
- Task 4: Arm the gate and prove both directions (depends on: Task 3, hands off: the hook entry and the probe evidence)
- Task 5: Fold the mechanism into the skill (depends on: Task 4, hands off: the shipped-gate language and the incremental convention)
- Task 6: Process record (depends on: Task 5, hands off: the record every later reader cites)
- Task 7: Verification and pull request (depends on: Task 6, hands off: the pushed branch and the review status)

## Risks

- [Risk] The gate is three months old and ships weekly, so an update can change behavior → Mitigation: the exact pin plus Renovate puts every update through review, and the arming probe in Task 4 becomes the check a reviewer reruns.
- [Risk] A model call on each in-scope edit adds latency and cost → Mitigation: the allow list holds the rule to two source trees, and the upstream fast path covers the common single-test edit.
- [Risk] A validation failure fails closed and stops all in-scope work → Mitigation: the probe in Task 4 gives the maintainer a one-command way to tell a broken gate from a working one, and the scope keeps the blast radius off documents and tooling.
- [Risk] The per-subagent record path is a convention the harness never documented, so a harness change breaks the derivation → Mitigation: the resolver falls back to the payload's own path when the derived record is missing, which restores today's behavior rather than an outage, and the arming probe in Task 4 is the check that detects it.
- [Risk] The gate binary is a dependency no module imports, so the dead-code gate flags it → Mitigation: Task 2 records it in the dead-code configuration with the hook as its consumer.
- [Risk] Shell-driven writes skip the gate → Mitigation: Decision 6 states the boundary and names the matcher widening as the upgrade.
- [Risk] The incremental convention lets a reviewed range skip commits → Mitigation: the record names the ceiling and its upgrade path, inside the drift-protection model record 0039 already set.

## Migration and rollout

The scope contract and the dependency land before the hook, so the first armed edit reads a configuration that already exists. Task 4 then adds the hook entry and runs the probe in both directions. An in-scope edit with no failing test must stop, and the same edit after a failing test must proceed. A new hook entry may load only after a session restart. Rollback is one line: remove the hook entry and the gate stops firing, leaving a pinned dependency and a configuration file that do nothing.

## Open questions

None.

## End-to-end verification

Inside a worktree, edit a file under `apps/desktop/src` with no failing test in the session and confirm the tool call comes back denied with the reason. Write a failing test, run that package's suite, repeat the edit, and confirm it proceeds. Edit a markdown file, a configuration module, and a file under `.claude`, and confirm no gate interferes. A fresh-context reviewer then diffs the result against four criteria. The committed scope matches Decision 3. No committed file carries an absolute machine path. The dependency pins exact. The `test:workflows` script covers the formatter hook's scope invariant.
