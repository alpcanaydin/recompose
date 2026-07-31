# 0061: The slug comes from the name, folded by hand

**Status**: Accepted
**Date**: 2026-07-31

## Context

The creation sheet asked a person for a slug beside the display name. The port decision in Architecture Decision Record (ADR) 0056 took the slug out of the address, so a gateway answers at `http://localhost:<port>` with no path. Two things still carry the slug: the file `<slug>.json` and the route `#/gateways/<slug>`. A desktop app has no address bar, so a person sees neither.

Asking someone to invent a lowercase dashed name for a file they never open earns nothing. The reference asked for one because the address used to carry it.

## Decision

The sheet takes a display name and a port. `slugFromName` in `packages/contracts/src/gateway-config.ts` derives the slug, beside the schema that validates its result.

The derivation runs one pipeline, and its order carries weight:

1. Fold case through uppercase and back down.
2. Decompose to the Unicode form that parts a letter from its marks, then drop the marks.
3. Replace every run outside `[a-z0-9]` with a single dash, then trim both ends.
4. Cut at 63 characters and trim the dash a cut can leave behind.

A name that leaves nothing behind falls back to `gateway`.

The uppercase pass is what pulls a Turkish dotless `ı` onto a plain `i`, and a sharp `ß` onto a double `s`. Neither carries a decomposition, so decomposing alone would drop both. That pass runs first, because a dotted capital `İ` lowercases into a combining mark that only a later decomposition reaches. The allowlist runs last, because it alone catches a script nothing folded.

Duplicate names refuse rather than number themselves. The main process answers a save whose slug a stored gateway holds with a `name-conflict` code, and the name field reads "Another gateway holds this name." A name deriving a device name Windows reserves refuses at the sheet, because `gatewaySlugSchema` keeps that rule from ADR-0059.

## Alternatives

- **A slug package**: of six surveyed, only two meet both bounds, a Turkish dotless `ı` folding to a plain `i` and a Han name deriving nothing. One ships CommonJS into a module-only repository. The other adds a dependency tree and rewrites a name like `GPT4Gateway` into `gpt-4-gateway` by default.
- **A romanizing transliterator**: turns a Han name into readable Latin, the opposite of the fallback this design wants, and costs megabytes of tables.
- **Decomposing alone**: drops a Turkish dotless `ı` outright, so `Kapı` derives `kap` rather than `kapi`.
- **Numbering a duplicate name**: two gateways both reading `Codex` is its own confusion, and the name is the only thing a person sees.

## Consequences

**Good**: a person names a gateway and picks nothing else. The rule sits beside the schema, so the sheet, the main process, and the acceptance suite share one derivation by construction. A property test proves the function total over every string, answering each with a slug the contract accepts or the one refusal a rename fixes.

**Bad**: the fold is lossy on purpose, so `İ`, `I`, `ı`, and `i` all collapse onto one slug. Nothing turns Cyrillic or Han into Latin, so those names land on the fallback and collide with each other. A person meets that collision as a duplicate-name refusal, which names the wrong cause. Growing past a hand-written fold means adopting a package rather than growing a table.
