---
name: hook-exit-code-fail-open
description: Claude Code hooks fail open on any exit code except 2 and run in the session cwd, so cwd-relative hook commands are a standing bypass pattern to check in every settings.json diff
metadata:
  type: project
---

Any hook in `.claude/settings.json` that references a script or binary by cwd-relative path can be disarmed by a session `cd`.

**Why:** Verified against the hooks reference during the ADR-0040 review (2026-07-27): handlers "run in the current directory", the `CwdChanged` event exists because Claude executes `cd`, and "only exit code 2 blocks; exit code 1 is a non-blocking error and the action proceeds". A `node .claude/...` launch from a foreign cwd dies at MODULE_NOT_FOUND with exit 1, which allows the action. Probity itself is fail-closed (deny JSON on stdout, exit 0), so the launcher is the weak link, not the gate.

**How to apply:** In every diff touching `hooks` in settings.json, check whether the command survives a cwd that is not the checkout root. The documented fix is the `${CLAUDE_PROJECT_DIR}` placeholder for project scripts; binaries spawned inside a hook script should resolve against `import.meta.url`, not `./node_modules/.bin/...`.
