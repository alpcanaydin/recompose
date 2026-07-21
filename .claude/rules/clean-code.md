# Clean Code Rules

## Naming
- Names reveal intent: a reader should not need the implementation to understand what a variable/function/module is for.
- Domain language everywhere: `gateway`, `virtualModel`, `router`, `target`, `provider` — never generic `manager`, `helper`, `util`, `data`, `info`.
- Consistent vocabulary: one concept = one name across the codebase (don't mix `account`/`provider` for the same thing).

## Functions & modules
- Single responsibility: one function = one job, one module = one reason to change.
- Keep functions small; extract when a block needs a comment to explain what it does — the extracted name *is* the comment.
- No boolean flag parameters that switch behavior — split into two functions.
- Prefer pure functions in the core domain; push side effects (I/O, process, network) to the edges.

## Simplicity
- **KISS**: the simplest design that passes the tests wins. Cleverness is a cost.
- **YAGNI**: build only what the current requirement needs. Leave room to extend; do not build the extension.
- **DRY — for knowledge, not lines**: one authoritative representation per business rule. Two pieces of code that look alike but encode different decisions are NOT duplication — don't merge them.

## Errors
- No silent failures: never swallow an error without handling or propagating it.
- Fail with context: error messages carry what was attempted and why it failed (which provider, which gateway, which request).
- Model expected failures (rate limit, auth expired, target down) as typed results/states, not thrown surprises — they drive routing behavior.

## Comments
- **Never write comments.** Code explains itself through naming and structure; a block that needs explaining needs extracting or renaming instead.
- Sole exception: a constraint or invariant the code genuinely cannot express. If in doubt, don't write it.
- Delete commented-out code. Git remembers.
