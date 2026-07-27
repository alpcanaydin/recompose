---
name: gate-scope-anchored-to-session-root
description: Probity anchors its files globs to the directory of the probity.config.ts it discovers, so the test-first gate only covers the session's own checkout and skips every sibling worktree in silence
metadata:
  type: project
---

The edit-time test-first gate (ADR-0040) covers exactly one directory tree: the one holding the `probity.config.ts` that `findConfig` resolves by walking up from the resolver's own checkout root. Probity's `loadConfig` rewrites `apps/*/src/**` into `<that root>/apps/*/src/**` at load time. Any action path outside that root matches nothing, no rule runs, and the gate answers with empty stdout and exit 0, which Claude Code reads as no opinion.

**Why:** Reproduced 2026-07-28 end to end with the real `node_modules/.bin/probity` and the repo's own config. An identical `Write` of a brand-new implementation file returned a deny decision inside the checkout and a silent permit when the same file sat in a sibling worktree. The pipeline's implementation phase runs one `tdd-implementer` per cluster, one worktree each, and those subagents share the orchestrator's `${CLAUDE_PROJECT_DIR}`, so the gate is inert for exactly the work it was built to guard. Both worktree placements fail: sibling under `.claude/worktrees/` and nested under the session root, because `*` does not cross `/`.

**How to apply:** Whenever a gate's scope is a relative glob resolved against a config file, ask which checkout the config comes from and whether the acting agent edits a different one. The tell for this gate is a `probity.config.ts` glob without a `**` prefix; `anchorGlob` leaves `**`-prefixed globs unanchored, so those match any checkout. The same anchoring means a worktree branched before the gate landed silently inherits the parent checkout's config and its scope. Both failures look identical to a gate that allows everything.

See [[hook-exit-code-fail-open]] for the launcher-side silent permits in the same gate.
