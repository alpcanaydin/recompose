---
name: hook-exit-code-fail-open
description: Claude Code hooks fail open on any exit code except 2; check every settings.json hook for launch preconditions (cwd, interpreter capability, PATH) that can kill the handler with exit 1
metadata:
  type: project
---

Any hook in `.claude/settings.json` whose handler can die before reaching its gate logic is a standing bypass: only exit code 2 blocks, so a launch failure (exit 1, 127, ERR_UNKNOWN_FILE_EXTENSION) lets the action proceed with just a transcript notice.

**Why:** Verified twice. ADR-0040 review (2026-07-27): cwd-relative `node .claude/...` from a foreign cwd dies at MODULE_NOT_FOUND, exit 1, action proceeds. Gate review (2026-07-28): the fix anchored paths via exec form (`command: "node"` + `args` with `${CLAUDE_PROJECT_DIR}`, documented and placeholder-substituted per the hooks reference), but the launcher is a `.mts` file and the repo pins no node anywhere (no engines, no .nvmrc, mise.toml pins only vale/gitleaks). Reproduced: `node --no-experimental-strip-types resolve-transcript.mts` exits 1 with ERR_UNKNOWN_FILE_EXTENSION, so any PATH node without type stripping (<= 22.5, or hostile NODE_OPTIONS) silently disarms the test-first gate. Probity itself is fail-closed (verified live: missing transcript produces deny JSON on stdout, exit 0), so the launch step stays the weak link, never the gate.

A fourth precondition is quieter still, because it exits 0. An entry guard written `process.argv[1] === fileURLToPath(import.meta.url)` compares an unrealpathed value against a realpathed one: Node resolves `argv[1]` to an absolute path but leaves symlinks in place, while `import.meta.url` is realpathed. One symlinked component in the launch path makes the guard false, `main()` never runs, and the handler exits 0 with empty stdout and empty stderr, which a `PreToolUse` hook reads as no opinion. Redundant slashes and relative launches normalize away; only symlinks bite. Reproduced 2026-07-28 by launching `resolve-transcript.mts` through a symlinked parent. A spec that builds its scratch checkout with `realpathSync(mkdtempSync(...))` can never catch it.

**How to apply:** In every diff touching `hooks`, enumerate the preconditions between process spawn and the first fail-closed line of the handler: cwd, interpreter version/capability, PATH resolution, file extension loadability, NODE_OPTIONS, and the entry guard's path comparison. Each unpinned precondition is a fail-open edge. Current docs (v2.1.214+) show a `<hook name> hook error` notice with the first stderr line on non-blocking errors, so the exit-1 bypass is quiet; the entry-guard bypass shows nothing at all.

See [[gate-scope-anchored-to-session-root]] for the silent-permit path that lives past the launcher, inside the gate's own scope resolution.
