# Feature-kickoff-workflow proposal

## Why

The planning phase is the pipeline's widest machine stretch and the only one still run entirely by hand. Its discovery step dispatches five arms under a six-subagent cap, then a citation validator rejects any code-map reference the repository lacks. Today a session improvises that fan-out each time: the caps live in prose, the validator doesn't exist, and nothing records that the arms ran at all.

Rollout item 3 hands that step a script. The gain matches the one the review pass got. The caps become code rather than intention, the parallelism stops depending on whoever orchestrates, and the run leaves an artifact a later phase can read.

## What changes

- A `feature-kickoff` saved workflow lands under `.claude/workflows/`, runnable by name. It takes the change slug and the confirmed tier, dispatches the discovery arms in parallel under the documented cap, runs the citation validator over the code map, and gives a rejected reader one more pass with the validator's errors as input.
- The citation validator lands as a tested script beside the path guard. It's a deterministic check with no model call: every path a code map cites must exist, and every symbol it cites must appear in the file it names.
- The workflow writes its output into the change directory's discovery slot, which the prose gates already exempt, so a later phase reads findings from disk rather than from a session that has ended.
- The planning reference gains the concrete mechanism, and the skill's rollout note moves the citation validator out of the deferred list.
- A process Architecture Decision Record (ADR) records the seam the workflow stops at, the validator's deterministic shape and why no model call belongs in it, and the arms the workflow leaves behind.

## Capabilities

### New capabilities

None.

### Modified capabilities

- `development-process`: discovery runs as a workflow under a machine-enforced subagent cap, and a deterministic validator rejects a code map that cites a path or symbol the repository lacks.

## Impact

- Discovery stops depending on the orchestrating session to remember the caps and the arms.
- A hallucinated path or symbol fails before the design consumes it, at no model cost.
- The workflow stops at the brainstorm, because that step needs the maintainer and a workflow takes no input once it starts. Classification stays in the session for the same reason, since it ends in a confirmation.
- The design-reference arm stays in the session, because its tools live there rather than in a subagent.
