# Clean Code rules

## Naming
- Names reveal intent: a reader shouldn't need the implementation to understand what a variable/function/module is for.
- Domain language everywhere: `gateway`, `virtualModel`, `router`, `target`, `provider`, never generic `manager`, `helper`, `util`, `data`, `info`.
- Consistent vocabulary: one concept = one name across the codebase (don't mix `account`/`provider` for the same thing).

## Functions & modules
- Single responsibility: one function = one job, one module = one reason to change.
- Keep functions small. Pull a block into its own function when it needs a comment to explain what it does: the new function's name *is* the comment.
- Split any function that takes a boolean flag parameter to switch behavior into two functions.
- Prefer pure functions in the core domain; push side effects (I/O, process, network) to the edges.

## Simplicity
- **Keep It Simple, Stupid (KISS)**: the simplest design that passes the tests wins. Cleverness is a cost.
- **You Aren't Gonna Need It (YAGNI)**: build only what the current requirement needs. Leave room to extend. Don't build the extension.
- **Don't Repeat Yourself (DRY), for knowledge, not lines**: one authoritative representation per business rule. Two pieces of code that look alike but encode different decisions aren't duplication. Don't merge them.

## Errors
- No silent failures: never swallow an error without handling or propagating it.
- Fail with context: error messages carry the attempted operation and why it failed (which provider, which gateway, which request).
- Model expected failures (rate limit, auth expired, target down) as typed results/states, not thrown surprises. They drive routing behavior.

## Comments
- **Never write comments.** Code explains itself through naming and structure; a block that needs explaining needs extracting or renaming instead.
- Sole exception: a constraint or invariant the code genuinely can't express. If in doubt, don't write it.
- Delete commented-out code. Git remembers.
