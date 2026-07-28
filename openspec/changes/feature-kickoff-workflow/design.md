# Feature-kickoff-workflow design

## Header and change linkage

- Change id: feature-kickoff-workflow
- Schema: recompose
- Proposal: [proposal.md](proposal.md)
- Specs: [specs/development-process/spec.md](specs/development-process/spec.md)
- Discovery: None
- Tasks: [tasks.md](tasks.md)

## Context

The feature pipeline's planning phase opens with discovery: several readers and researchers run at once, and their findings feed the brainstorm and the solution design. Today a session improvises that fan-out from a prose table in `.claude/skills/feature-cycle/references/planning.md`. The table names five arms, a six-subagent cap, and a citation validator that rejects any code-map reference the repository lacks.

Two of those three are intentions rather than machinery. Nothing counts the subagents, and no validator exists, so a fabricated path reaches the design at full cost. The findings also live only in the orchestrating session, so a later phase in a fresh session has nothing to read.

The review pass already crossed this line: `.claude/workflows/review-pr.js` turned the review dispatch into a saved workflow, and `.claude/workflows/path-guard/` turned one of its rules into a tested script. This change applies the same treatment to discovery.

## Discovery inputs consumed

- `.claude/skills/feature-cycle/references/planning.md`: supplies the arm table, the six-subagent cap, the standard-tier fold, and the reason the design-reference arm stays in the session.
- `.claude/workflows/review-pr.js`: fixes the saved-workflow shape, which this workflow copies: a literal `meta` block, argument validation that throws, `parallel()` over a blueprint table, structured output through `schema`, and process assertions that throw rather than warn.
- `.claude/workflows/path-guard/path-guard.mts`: fixes the tested-script shape, which the validator copies: a pure exported decision function, a thin entry point behind `isProcessEntryPoint`, and a colocated `node:test` spec.
- Web research on citation checking: no off-the-shelf validator matches this shape, and the consensus on machine-written references is a deterministic existence check rather than a model judgement. It set the no-model-call decision below.
- `docs/adr/0040-edit-time-test-first-gate.md`: consulted, no impact, beyond the record-accuracy lesson applied to this document.

## Goals and non-goals

**Goals:**

- Discovery runs from a saved workflow, so the arms and the cap stop depending on the orchestrating session.
- The six-subagent cap becomes a throwing assertion in the dispatching machinery.
- A code map citing a path or symbol the repository lacks fails deterministically, at no model cost, before the design consumes it.
- A rejected code map returns to its reader once, with the failures as input.
- Discovery output lands in the change directory, so a later phase reads it from disk.

**Non-goals:**

- Classification stays out. It ends in a maintainer confirmation, and a workflow takes no input once it starts.
- The brainstorm stays out, for the same reason. The workflow stops at that seam.
- The design-reference arm stays in the session, because the Mobbin Model Context Protocol (MCP) tools live there rather than in a subagent.
- No approval gate, no `manifest.md` write, and no branch or worktree handling. This workflow runs one step.
- The validator resolves no symbol semantics. It proves a mention, not a declaration or an export.

## Constraints and invariants

- TypeScript at maximum strictness: `strict: true` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`. No `any`, no `as` casts to silence errors, no `@ts-ignore` or `@ts-expect-error` without a reason.
- Never write code comments. The sole exception is a constraint the code genuinely can't express.
- Test-first, inside-out, state-based. A test asserts on returned or observable state, never on the call order of internals.
- Feature-Sliced Design governs the renderer only. Both artifacts here sit under `.claude/workflows/`, outside `apps/` and `packages/`, so no layer applies.
- `main` stays protected. One job, one branch, one pull request.
- Every commit passes lefthook without bypass, and `openspec validate --all --strict --no-interactive` stays green after each one.
- The `.claude/workflows/` tree stays exempt from Vale and cspell, matching `.claude/commands`.

## Design

The change ships two artifacts that meet at one seam.

**The `feature-kickoff` saved workflow** lands at `.claude/workflows/feature-kickoff.js` and runs by name with `{ slug, tier }`. It runs three phases.

_Discover._ An arm table, a literal constant, folds by tier. The `full` tier dispatches four arms: technical research and acceptance references through `researcher`, the code map and the rider-ledger lookup through `code-analyzer`. The `standard` tier folds to two, matching the reference: one `researcher` covers research, acceptance references, and the rider ledger, and one `code-analyzer` maps the code. Before the dispatch, an assertion throws when the phase's planned subagent count exceeds six. It counts dispatches rather than table rows, because the phase spends subagents beyond the arms themselves. Neither `researcher` nor `code-analyzer` holds a write tool, so one writer subagent puts every arm's findings into `openspec/changes/<slug>/discovery/` after the fan-out. The full tier therefore spends six: four arms, the writer, and the validator. The writer reports the byte length it wrote, and the workflow compares that against what it sent, because a subagent asked to reproduce text can truncate it.

_Validate._ The code map returns as data rather than prose: a list of entries, each carrying a path, the symbols cited in it, its Feature-Sliced Design layer, and a note. The workflow renders the markdown from those entries, which makes every claim in the map a citation by construction. A single cheap subagent runs the validator script over the entries and returns its verdict through a schema. That subagent is a shell for a command, not a judge, because the decision lives in the script.

_Recheck._ A failed verdict re-dispatches the `code-analyzer` arm once, with the failing citations as input, then validates again. A second failure throws, and the arms' files already sit on disk, so the throw discards nothing.

**The citation validator** lands at `.claude/workflows/citation-validator/citation-validator.mts` beside the path guard, in the same shape. A pure exported function takes the citation list and a file reader, and returns a verdict naming every failing citation. The entry point supplies `node:fs`, resolves cited paths against a repository root it takes as an argument, and prints the verdict as JSON.

Two rules decide a citation, in order:

1. The cited path must resolve inside the repository root and exist there. A path given relative to the root and an absolute path landing inside it both satisfy this. A path escaping the root fails with a reason naming the escape, distinct from the reason for a path that's merely absent, because a reader told "not found" would hunt for a file that exists.
2. Every symbol the entry cites must appear in that file's text as a standalone token.

A missing path reports as one failure and skips its symbol checks. Every symbol under a missing path fails for the same reason, and one failure per symbol buries that cause.

The seam between the two artifacts is the entry list. The workflow owns the retry, the validator owns the decision, and neither knows the other's phase structure.

## Data model and contracts

The code-map entry is the only structure crossing a boundary:

- `path`: the cited path, as a non-empty string, either relative to the repository root or absolute inside it.
- `symbols`: the symbols the entry cites in that file, as an array of non-empty strings, possibly empty.
- `layer`: the Feature-Sliced Design layer, or a marker for a path outside the renderer, as a non-empty string.
- `note`: one line on what the entry contributes to the feature, as a non-empty string.

The verdict is the validator's output contract:

- `status`: `pass` or `fail`.
- `failures`: each carrying the path, the missing symbol when a symbol caused it, and the reason.

The entry point emits a third shape when it can't reach a verdict at all, carrying `status: error` and a `reason`, with no `failures` key. A schema over this contract accepts all three shapes. A caller that can't parse the error shape reads an input fault as a citation failure.

## Error handling

- **Missing or malformed arguments.** The workflow throws before dispatching anything, naming the missing keys, matching `review-pr`.
- **An arm that dies.** The dispatch hook returns `null` on a terminal failure. A dead code-map arm throws, because the validation phase then has nothing to check, and an empty code map counts as dead for the same reason. Every other arm logs and continues, because a brief feeds a human step rather than a machine gate. The rule keys on what the arm produces, not on which subagent type ran it, since one `code-analyzer` arm produces a brief.
- **A failing verdict.** Recorded, fed back to one rerun, and thrown on the second failure with every failing citation named.
- **An unreadable cited file.** Rejected, because a citation the validator can't verify is a citation it rejects. The reason names what actually happened, so a path that resolves to a directory doesn't report as missing. A reader told to fix a path that already exists can't act on it.
- **A missing or wrong repository root.** Reported through the input-error channel, never as a verdict. A root that doesn't exist would otherwise fail every citation in a correct code map with a false reason, which is the most confident wrong answer this script can give.
- **A malformed entry list.** Every entry must carry every field as a non-empty value at its declared type, and a violation throws rather than degrading. An empty `symbols` array stays legal, because an entry may cite a path alone. A `symbols` value that isn't a list of non-empty strings is the one that matters most: coercing it to an empty list turns a code map full of invented symbols into a pass.
- **Unparsable input.** Reported on stdout as a distinct outcome with its own exit code, so the caller separates a validator that couldn't read its input from a code map that failed. Under one exit code the workflow would rerun `code-analyzer` for a fault the reader didn't cause, then throw with no failing citation to name.
- **A verdict missing its payload.** The workflow's schema requires a failure list on a failing verdict and a reason on an input fault, because reading either one unguarded turns a reported failure into a crash inside the phase seam.

## File map

- `.claude/workflows/feature-kickoff.js`: the saved workflow that dispatches the discovery arms, enforces the cap, and drives validation (create).
- `.claude/workflows/citation-validator/citation-validator.mts`: the pure verdict function and its entry point, which resolves cited paths against an explicit repository root rather than the working directory (create).
- `.claude/workflows/citation-validator/citation-validator.test.mts`: the colocated unit spec (create).
- `.claude/workflows/citation-validator/citation-validator.entrypoint.test.mts`: the colocated integration spec covering the verdict cases (create).
- `.claude/workflows/citation-validator/citation-validator.entrypoint-input.test.mts`: the colocated integration spec covering the input contract (create). The repository's 300-line file rule caps any one spec, so a further split follows the seams the `describe` blocks already name rather than a fixed file count. The hooks tree sets that precedent with five specs over one gate.
- `.claude/skills/feature-cycle/references/planning.md`: step 2 gains the concrete mechanism (modify).
- `.claude/skills/feature-cycle/SKILL.md`: the rollout note moves the citation validator out of the deferred list (modify).
- `docs/adr/0041-discovery-workflow-and-citation-validator.md`: the process record (create).
- `docs/adr/README.md`: the index row (modify).

## Interfaces

- Consumes: the `researcher` and `code-analyzer` subagent types, the workflow harness hooks `agent`, `parallel`, `phase`, `log`, and `args`, and `isProcessEntryPoint` from `.claude/workflows/hooks/entry-point.mjs`.
- Produces:
  - `export function validate(entries: readonly CodeMapEntry[], readFile: (path: string) => string | null): Verdict`
  - `export type CodeMapEntry = { path: string; symbols: readonly string[]; layer: string; note: string }`
  - `export type Verdict = { status: 'pass' | 'fail'; failures: readonly CitationFailure[] }`
  - `export type CitationFailure = { path: string; symbol?: string; reason: string }`
  - The workflow's return value: the discovery directory, the arm labels with their written files, the validated entries, and whether a recheck ran.
  - The entry point's process contract, which the caller resolves rather than inheriting from the working directory: the repository root as the first argument, the entry list on standard input, the verdict or the error shape on standard output, and three exit codes. Zero means pass, one means a failing verdict, and two means the script never reached a verdict.

## Decisions

### 1. The workflow stops at the brainstorm

Classification ends in a maintainer confirmation, and the brainstorm is a conversation. Neither fits a workflow, which takes no input once it starts, so the workflow covers the discovery step alone.

**Alternatives considered:** one workflow for the whole planning phase, rejected because it would have to guess the maintainer's answers or stop mid-run for them. The harness supports neither.

**Architecture Decision Record (ADR) draft:** [0041](../../../docs/adr/0041-discovery-workflow-and-citation-validator.md)

### 2. The code map returns as data, and the workflow renders it

Structured entries make every claim in the map a citation by construction, so nothing unchecked sits beside something checked. They also keep markdown parsing out of the validator.

**Alternatives considered:** parsing citations out of a prose code map, rejected because a parser decides what counts as a citation. Every reference it misses would pass unchecked.

### 3. The validator makes no model call

Whether a path exists is a fact about the repository, not a judgement, so a deterministic check answers it exactly and for free. Research found no off-the-shelf validator for this shape and confirmed the deterministic approach as the standard one.

**Alternatives considered:** a reviewer subagent auditing the map, rejected because it costs a model call to answer a question `existsSync` answers, and it can be wrong.

### 4. A symbol check matches a standalone token, with conditional boundaries

The check proves the file mentions the symbol. Resolving declarations would need a TypeScript program per cited file, and citations span markdown, YAML, and shell as well.

A boundary anchor applies only where the symbol's own edge character is a word character. A plain `\b` at both ends never matches a symbol that starts or ends with punctuation, which false-fails the citations this decision exists to support: `@recompose/contracts`, `--fail-on-warnings`, `pre-commit`. A false failure is worse than a missed one here. The workflow's single rerun can't repair a citation that was already correct, so discovery would throw on a clean code map.

**Alternatives considered:** an abstract-syntax-tree lookup, rejected on cost and on coverage across non-TypeScript files. A plain `\b` at both ends, rejected because it false-fails scoped package names and flags. The looser check still catches the failure that matters, a symbol invented wholesale.

### 5. A rejected map reruns once, then throws

One rerun answers the common case, a reader that cited a path from memory. A second failure means the reader can't ground its claims, and looping further burns model calls against a stuck arm.

**Alternatives considered:** unbounded retries, rejected as a cost sink. No retry at all, rejected because it fails the whole discovery over a repairable mistake.

### 6. An input fault takes its own exit code

Exit code two carries every fault that stops the script from reaching a verdict: a missing or wrong repository root, unparsable input, and a malformed entry. Two is the conventional status for a usage error, and it stays unambiguous against zero and one.

Under one exit code the caller can't separate a validator that couldn't read its input from a code map that failed. The workflow would rerun `code-analyzer` for a fault the reader didn't cause, then throw with no failing citation to name.

**Alternatives considered:** exit one for everything, with the distinction carried in the payload alone, rejected because a caller that fails to parse the payload falls back on the exit code. One caveat holds: the hook protocol reads exit two as a blocking verdict, so this script must stay off the hook chain.

### 7. The cap lives in the workflow, not in the validator

The cap governs dispatch, and the dispatching machinery is the workflow. A throwing assertion over the folded arm table keeps the rule where the arms are.

**Alternatives considered:** trusting the arm table's length by inspection, rejected because the spec requires machine enforcement. A later contributor who adds an arm gets a throw rather than a silent breach.

## Test matrix

| Layer          | What this layer proves (or why none)                                                                                                                                                                                                                                                                                                                                             | Check command             |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Unit           | The verdict function: a missing path fails and names itself, a missing symbol fails and names itself, a path with every symbol present passes, a missing path reports once rather than once per symbol, and an unreadable file fails for the reason that stopped the read.                                                                                                       | `pnpm run test:workflows` |
| Integration    | The entry point end to end: the script runs against a scratch repository from an unrelated working directory, rejects a path escaping the root with a reason naming the escape, separates an input fault from a failing verdict by exit code, and prints JSON on standard output in every case. Containment lives in the reader the entry point supplies, so this layer owns it. | `pnpm run test:workflows` |
| End-to-end     | None. The artifacts are development-pipeline machinery outside the desktop application, so no Playwright scenario reaches them.                                                                                                                                                                                                                                                  | none                      |
| Property       | None. The verdict function has no algebraic invariant worth generating over: it's a membership check against the filesystem, and the example cases cover its branches exhaustively.                                                                                                                                                                                              | none                      |
| Mutation scope | None. The Stryker gate scopes to node-side application logic under `apps/` and `packages/`, and this change adds nothing there. The unit and integration specs are the compensating cover, matching the path guard's recorded exception.                                                                                                                                         | `pnpm run test:mutation`  |

The saved workflow itself carries no spec. No test can import it, because it uses top-level `await` and a top-level `return`, and its hooks exist only inside the workflow harness. `review-pr.js` set that precedent. The design keeps the workflow thin for that reason, so every decision worth testing sits in the validator.

## Task decomposition hooks

- Task 1: The citation validator and its specs (depends on: none, hands off: `validate`, `CodeMapEntry`, and the process contract the workflow reads).
- Task 2: The `feature-kickoff` saved workflow (depends on: Task 1, hands off: the discovery directory contract the planning reference documents).
- Task 3: The skill reference and the rollout note (depends on: Task 2, hands off: nothing).
- Task 4: The process record, ADR-0041 (depends on: every decision above, hands off: nothing to a later task).
- Task 5: The pull request (depends on: Tasks 1 to 4).

## Risks

- [Risk] The cap assertion ships untested, because no test imports the workflow → Mitigation: the arm table is a literal constant and the assertion is one line over it, so a reader verifies it by reading. ADR-0041 records the untested seam.
- [Risk] A reader cites a real path with a symbol spelled as it appears in a comment or a string rather than a declaration, and the check passes → Mitigation: recorded as a known limit. The check catches invention, which is the failure it exists for.
- [Risk] Structured entries constrain how expressive a code map can be → Mitigation: the `note` field carries prose per entry, so expressiveness stays attached to a checked path.
- [Risk] Containment is lexical rather than resolved through the filesystem, so a symlink inside the root that points outside stays readable → Mitigation: deliberate. This repository's package manager links workspace packages, so resolving symlinks would reject legitimate citations of `packages/contracts` through `node_modules`. Recorded as a known limit.
- [Risk] The validating subagent misreports the script's output → Mitigation: it returns the verdict through a schema that requires the failure list on a failing verdict, and the workflow reads that list rather than a summary sentence.
- [Risk] The workflow's own dispatch counting drifts from the cap the skill states → Mitigation: the assertion counts the phase's planned subagents, and the design states the arithmetic, so a later contributor adding a dispatch sees the number move.

## Migration and rollout

None. Both artifacts are new files, nothing consumes them yet, and the planning reference gains the mechanism in the same change. No data migrates and no deployment changes. Rolling back means deleting two files and reverting two documents.

## Open questions

None.

## End-to-end verification

`pnpm run test:workflows` passes with the new specs included, and the validator's entry point rejects a planted bad citation from the command line while accepting a real one. The saved workflow lists under its name in the harness, and a dry run on this change's own slug writes the arm files into `openspec/changes/feature-kickoff-workflow/discovery/`.

A fresh-context reviewer diffs the result against these criteria:

- The validator exports a pure verdict function, with a colocated spec covering every branch above.
- The workflow's arm table folds by tier exactly as `planning.md` states.
- The cap assertion throws rather than logs.
- The recheck runs at most once and throws on a second failure.
- The planning reference names the workflow, its arguments, and the discovery directory.
- The rollout note drops the citation validator from the deferred list.
- ADR-0041 records every decision in this document, including the untested workflow seam and the symbol check's limit.
