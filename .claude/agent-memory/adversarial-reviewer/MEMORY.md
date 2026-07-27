# Memory index

- [Hook exit-code fail-open](hook-exit-code-fail-open.md) — only exit 2 blocks; any launch precondition (cwd, node version, PATH, argv entry guard) that kills a hook handler is a bypass
- [Gate scope anchored to session root](gate-scope-anchored-to-session-root.md) — probity globs anchor to the discovered config's directory, so the test-first gate skips every sibling worktree in silence
