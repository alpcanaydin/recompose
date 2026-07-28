---
name: gate-scope-anchored-to-session-root
description: Probity anchors its files globs to the directory of the config it loads; the fix that walks up from the edited path closed the worktree gap but widened the trust boundary to any ancestor directory
metadata:
  type: project
---

The edit-time test-first gate (ADR-0040) originally covered exactly one directory tree: the one holding the `probity.config.ts` that `findConfig(process.cwd())` resolved from the resolver's own checkout. `loadConfig` rewrites `apps/*/src/**` into `<that root>/apps/*/src/**` at load time, so any action path outside that root matched nothing and the gate answered with empty stdout and exit 0, which Claude Code reads as no opinion.

**Why:** Reproduced 2026-07-28 with the real `node_modules/.bin/probity`. An identical `Write` returned a deny inside the checkout and a silent permit in a sibling worktree. Both worktree placements failed, sibling and nested, because `*` does not cross `/`. The fix walks up from the payload's `file_path` for the nearest `probity.config.ts` and passes it through `--config`, which probity anchors correctly. Two residues, both reproduced the same day: (1) the walk runs to `/`, so an edit anywhere under a foreign directory holding a `probity.config.ts` makes the hook execute that config through jiti before the gate decides, and the sibling `format-edit.mts` executes `<that directory>/node_modules/.bin/oxfmt` and `oxlint` the same way. (2) `readEditedPath` reads only `tool_input.file_path`, while the matcher is `Edit|Write|NotebookEdit` and NotebookEdit carries `notebook_path`, so notebook edits still fall back to the session checkout's config.

**How to apply:** Whenever a gate's scope is a relative glob resolved against a config file, ask which checkout the config comes from and whether the acting agent edits a different one. The tell is a `probity.config.ts` glob without a `**` prefix; `anchorGlob` leaves `**`-prefixed globs unanchored. When the fix is "derive the config from the payload path," check the other direction too: whose code now runs, and whether every tool in the matcher exposes its path under the same key.

See [[hook-exit-code-fail-open]] for the launcher-side silent permits in the same gate.
