# 0041: The discovery workflow and the citation validator

**Status**: Accepted
**Date**: 2026-07-28

## Context

This Architecture Decision Record (ADR) follows ADR-0038 and ADR-0039. ADR-0038 defined the feature cycle as an executable process. ADR-0039 turned the cycle's review pass into a saved workflow with one tested script beside it. This record gives the discovery pass the same treatment.

The planning phase opens with discovery, and a prose table in `.claude/skills/feature-cycle/references/planning.md` carried the whole mechanism. That table named five arms, a six-subagent cap, and a validator that rejects any code-map reference the repository lacks. Two of the three stayed intentions. Nothing counted the subagents, no validator existed, and a fabricated path reached the solution design at full cost. The findings also lived only in the orchestrating session, so a later phase in a fresh session had nothing to read.

The behavioral contract lives in the `development-process` capability under `openspec/specs/`, and this record holds the decisions behind the two files that carry it.

## Decision

recompose runs the discovery fan-out from a saved workflow and decides every citation in a deterministic script. The workflow at `.claude/workflows/feature-kickoff.js` dispatches the arms, enforces the cap, and drives the retry. The validator at `.claude/workflows/citation-validator/citation-validator.mts` owns the verdict and spends no model call on it. Both files sit under `.claude/workflows/`, which ADR-0039 established as the home for repository tooling and which the prose gates exempt.

- **The workflow stops at the brainstorm, and classification stays in the session.** A workflow takes no input once it starts. Classification ends in a maintainer confirmation, and the brainstorm is a conversation, so neither one fits. The workflow covers the discovery step alone and takes `{ slug, tier }`, where the slug names the change directory and the tier arrives already confirmed. `requireArgs` throws on a missing or empty value, and it throws again on a tier the arm table doesn't name. The design-reference arm stays in the session for a second reason: the Mobbin Model Context Protocol tools live there, and the `researcher` subagent pins its tools to web search, web fetch, and file reads.

- **The code map returns as data, and the workflow renders the Markdown.** The `code-map` arm answers through a schema rather than in prose. Each entry carries a path, the symbols cited in it, its Feature-Sliced Design layer, and one line on what the entry contributes. `renderCodeMapMarkdown` in the workflow turns those entries into the text that reaches disk. Every claim in the map becomes a citation by construction, so nothing unchecked sits beside something checked, and no Markdown parser enters the validator. One writer subagent puts every arm's text on disk, because neither `researcher` nor `code-analyzer` holds a write tool. It reports the byte length it wrote per file and the workflow checks that against what it sent, since a subagent asked to reproduce text can truncate it.

- **The validator makes no model call.** Whether a path exists is a fact about the repository rather than a judgement, so `existsSync` answers it at no cost. Research over citation checking found no off-the-shelf validator for this shape and confirmed the deterministic existence check as the standard answer. The workflow still dispatches one subagent for the validation step, pinned to `haiku`. That seat runs the command and reports the JSON the script printed. It serves as a shell for a command rather than as a judge, because the decision lives in the script.

- **A symbol check matches a standalone token, and the word boundary is conditional.** `symbolPattern` escapes the symbol's regular-expression metacharacters, then anchors an edge only where the symbol's own edge character is a word character. That condition earns its space in this record. A plain `\b` at both ends never matches a symbol that starts or ends with punctuation, and it false-fails `@recompose/contracts`, `--fail-on-warnings`, and `pre-commit`. Those are the citations the rule exists to support. A false failure costs more than a missed one here, because the single rerun below can't repair a citation that was already correct, so discovery would throw on a clean code map.

- **Two rules decide a citation, in order.** The cited path must resolve inside the repository root and exist there, and every symbol the entry cites must appear in that file's text as a standalone token. A path that escapes the root fails with a reason naming the escape, distinct from the reason for a path the repository merely lacks, because a reader told "not found" would hunt for a file that exists. A path the validator finds but can't read fails for the reason that stopped the read, so a directory citation never reports as missing. A missing path reports once and skips its symbol checks, since one failure per symbol would bury the cause.

- **A rejected code map reruns once, then throws.** A failing verdict sends the `code-map` arm back out with the failing citations named in its prompt, and the workflow validates the returned map again. One rerun answers the common case, a reader that cited a path from memory. A second failure means the reader can't ground its claims, so the workflow throws and names every failing citation. Looping further would burn model calls against a stuck arm. The arms' files already sit on disk when the throw lands, so the throw discards nothing.

- **An input fault takes its own exit code.** The entry point exits 0 on a pass, 1 on a failing verdict, and 2 for every fault that stops it short of a verdict: a missing, empty, or non-directory repository root, input the parser can't read, and a malformed entry. Exit 2 prints a `status` of `error` with a `reason` and no `failures` key, and the workflow throws on that shape rather than treating it as a citation failure. Under one exit code the workflow would rerun the `code-analyzer` arm for a fault the reader never caused, then throw with no failing citation to name. One caveat travels with the choice. The hook protocol reads exit 2 as a blocking verdict, so this script must stay off the hook chain.

- **The cap lives in the workflow rather than in the validator.** The cap governs dispatch, and the dispatching machinery is the workflow. `assertDispatchCapRespected` counts the fan-out's planned subagents rather than the arm table's rows, and it throws above six before anything dispatches. The `full` tier plans exactly six: four arms, one writer, and the validating seat. The `standard` tier plans four. Counting rows instead would have understated the total, because the phase spends subagents beyond the arms themselves, and the workflow exists to make that number machine-checked. A contributor who adds an arm sees the number move.

- **A dead code-map arm throws, and every other dead arm logs.** The dispatch hook answers `null` on a terminal failure. `resolveArmQuery` keys the throw on what the arm produces rather than on which subagent type ran it, so only the code-map arm stops the run, and an empty code map counts as dead for the same reason. The validation phase would otherwise have nothing to check. Every brief arm logs and the run continues, because a brief feeds a human step rather than a machine gate. Keying on the subagent type would have been stricter than the reason behind the rule: the `rider-ledger` arm on the `full` tier rides `code-analyzer` while producing a brief, so its death would have thrown too.

## Limits this design keeps

A future reader who trusts the mechanism further than these bounds allow will rediscover them the expensive way, so this section states them plainly.

- **The saved workflow ships with no spec.** No test can import it. It uses top-level `await` and a top-level `return`, and its hooks, `agent`, `parallel`, `phase`, `log`, and `args`, exist only inside the workflow harness. `review-pr.js` set that precedent under ADR-0039. The mitigation is shape rather than coverage. The workflow stays thin, and every decision worth testing sits in the validator. The arm table is a literal constant and the cap assertion is one line over it, so a reader verifies both by reading.

- **The symbol check proves a mention rather than a declaration or an export.** It accepts a symbol that appears only in a comment or a string. Resolving declarations would need a TypeScript program per cited file, and citations reach Markdown, YAML, and shell files as well. The check still catches the failure it exists for, a symbol invented wholesale. A looser consequence rides along: a cited `--fail` matches inside `--fail-on-warnings`.

- **Containment is lexical rather than resolved through the filesystem.** `resolveWithinRepository` compares the resolved path against the resolved root and rejects a result that starts with two dots or that lands absolute. It consults no symlink, so a link inside the repository that points outside stays readable. That choice is deliberate. This repository's package manager links workspace packages, and resolving symlinks would reject legitimate citations of `packages/contracts` through `node_modules`.

- **Harness behaviors stayed assumed until the first run, and one of them was wrong.** The workflow can't run outside the harness, so four things it depends on rested on convention rather than on a passing check: the `haiku` model alias, the write and command tools the default subagent type grants, schema support for a choice among closed shapes, and the text encoder the byte check used. The first run failed on the last of those, because the workflow sandbox defines no text encoder, though the runtime underneath it does. The byte count now uses an encoding built-in that the sandbox does define. The other three remain unconfirmed, and the run hasn't yet reached them. The encoder failure surfaced as an error rather than as a wrong result, which is what made it cheap to find, but nothing establishes that the remaining three would fail as visibly.

- **The mutation gate reaches neither file.** The Stryker gate scopes to `apps/` and `packages/`, and both artifacts sit under `.claude/workflows/`. This change takes the documented exception route rather than a weakened threshold, matching how ADR-0039 recorded the same exception for the path guard. The compensating cover is the validator's unit spec and its two integration specs, which `pnpm run test:workflows` runs.

## How the review confirmed its findings

The validator went through three fix rounds, and the method the reviewer used is the reusable lesson. The reviewer confirmed each finding by mutating the shipped code and rerunning the specs rather than by reading alone. That method caught cases where a spec looked sufficient and wasn't. One example carries the point. The case that proved the entry index in a failure message drove a single-entry payload. A mutant that hardcoded the index to zero survived it, because the real index and the hardcoded one coincided by construction. The rewrite put a well-formed entry first and the malformed one second.

Two shapes stayed known rather than fixed. A branch in `resolveWithinRepository` fires only on a Windows cross-drive citation, which no portable test constructs. The lexical containment check also reads a repository file whose own name starts with two dots as an escape, and nothing in this checkout carries such a name. The point for a future reader is the method rather than the tally.

## Alternatives

- **One workflow for the whole planning phase**: rejected. It would have to guess the maintainer's answers or stop mid-run for them, and the harness supports neither.
- **Parsing citations out of a prose code map**: rejected. A parser decides what counts as a citation, and every reference it misses passes unchecked.
- **A reviewer subagent auditing the map**: rejected. It spends a model call on a question `existsSync` answers, and it can be wrong.
- **An abstract-syntax-tree lookup for symbols**: rejected on cost and on coverage. Citations reach Markdown, YAML, and shell files that no TypeScript program parses.
- **A plain word boundary at both ends of the symbol**: rejected. It false-fails scoped package names and command-line flags, which turns a correct code map into a thrown discovery run.
- **Unbounded retries on a failing verdict**: rejected as a cost sink against a stuck arm.
- **No retry at all**: rejected. It fails the whole discovery over a repairable mistake.
- **Exit 1 for everything, with the distinction carried in the payload alone**: rejected. A caller that fails to parse the payload falls back on the exit code.
- **Trusting the arm table's length by inspection**: rejected. The capability requires machine enforcement, and a contributor who adds an arm should meet a throw.
- **Resolving symlinks in the containment check**: rejected. Workspace packages reach `packages/contracts` through `node_modules` links, and resolving would reject those citations.

## Consequences

**Good**: discovery runs from a saved workflow, so the arms and the cap no longer depend on the orchestrating session improvising from a prose table. A fabricated path or an invented symbol fails at no model cost, before the solution design consumes it, and the reader gets one repair attempt with the failures named. Every arm's findings reach `openspec/changes/<slug>/discovery/`, so a later phase in a fresh session reads them from disk. The verdict function stays pure and takes its file reader as an argument, so its unit spec needs no filesystem.

**Bad, and accepted**: the workflow carries no spec, so its cap assertion, its tier fold, and its retry rest on review by reading. The symbol check proves a mention, so a symbol that appears only in a comment passes. Containment is lexical, so a symlink inside the repository that points outside stays readable. Neither file falls inside the mutation gate's scope, and the two specs are the whole cover. The validating seat spends one cheap model call to relay a verdict the script already decided, and it could misreport that verdict. The schema and the failure list contain that risk rather than prevent it. The entry point's exit 2 collides with the hook protocol's blocking verdict, so this script must stay off the hook chain.
