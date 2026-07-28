---
name: hook-exit-code-fail-open
description: Claude Code hooks fail open on any exit code except 2; check every settings.json hook for launch preconditions (cwd, interpreter capability, PATH, entry guard) that can kill the handler before its gate logic runs
metadata:
  type: project
---

Any hook in `.claude/settings.json` whose handler can die before reaching its gate logic is a standing bypass: only exit code 2 blocks, so a launch failure (exit 1, 127, ERR_UNKNOWN_FILE_EXTENSION) lets the action proceed with just a transcript notice, and an entry guard that silently declines to run `main()` exits 0 with empty output, which a `PreToolUse` hook reads as no opinion.

**Why:** Verified three times on this repo's test-first gate. ADR-0040 review (2026-07-27): cwd-relative `node .claude/...` from a foreign cwd dies at MODULE_NOT_FOUND, exit 1, action proceeds. Gate review (2026-07-28, round 1): exec form plus `${CLAUDE_PROJECT_DIR}` fixed the path, but the handler was a `.mts` file and no Node floor was pinned, so any PATH node without unflagged type stripping exits 1 and disarms the gate. Round 1 also found the path-string entry guard: `process.argv[1] === fileURLToPath(import.meta.url)` compares an unrealpathed value against a realpathed one, so one symlinked component makes it false and `main()` never runs.

Round 2 (2026-07-28) found the *fix* reintroduced the same class. `import.meta.main` replaced the path comparison, but it was added in Node v24.2.0 and v22.18.0 only, while the repo declared `engines.node` and `NODE_FLOOR` as `^22.18.0 || >=23.6.0`. On Node 23.6.0 through 24.1.x the module loads, `import.meta.main` is `undefined`, `main()` never runs, and the `.mjs` launcher forwards exit 0 with empty stdout. Reproduced on 23.11.1 and 24.1.0 (deny under 26.5, silent permit under both). The launcher's own "node cannot run the gate" branch only fires on exit 1, so it cannot see this. CI's `node-version: 24` resolves to the newest 24.x, so no gate catches it. The same guard sits in `path-guard.mts`, where it turns the CI blast-radius guard into a no-op that reports success.

Round 3 (2026-07-28) closed it with a shared `.claude/workflows/hooks/entry-point.mjs` that realpaths `process.argv[1]` and compares against the module URL, used by the launcher, the resolver, and the path guard. Verified: the workflow suite is 72/72 green on Node 22.18.0, 23.6.0, and 26.5.0, so the `workflow-floor` CI matrix at both lower edges of `^22.18.0 || >=23.6.0` holds. Do not re-run that measurement.

**How to apply:** In every diff touching `hooks`, enumerate the preconditions between process spawn and the first fail-closed line of the handler: cwd, interpreter version, PATH resolution, file-extension loadability, `NODE_OPTIONS`, and the entry guard. Treat every entry-guard *mechanism* as a version claim: check the feature's `added:` versions in `https://nodejs.org/api/<module>.json` against the declared `engines` range before accepting it. A guard that can evaluate falsy under a supported runtime is worse than the bug it replaced, because it exits 0. Check whether the fix was applied to every hook: a launcher that hardens one handler while a sibling handler stays a bare `.mts` leaves half the class open.

See [[gate-scope-anchored-to-session-root]] for the silent-permit path that lives past the launcher, inside the gate's own scope resolution.
