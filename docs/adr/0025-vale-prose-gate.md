# 0025: Vale prose gate with Microsoft style at full strength

**Status**: Accepted
**Date**: 2026-07-24

## Context

Authors write the repository's records and docs once. Models mostly read them forever, with no human copyeditor in the loop. A misspelled domain term or drifting terminology becomes permanent vocabulary without anyone noticing. Nothing machine-checked the prose. The control-gates queue orders a prose linter sixth. The maintainer set the direction in a brainstorm. Outward-facing documentation deserves the friendlier Microsoft register, and every Architecture Decision Record (ADR) explains something to someone. The gate should run at full strength rather than error-only.

## Decision

- **Vale 3.15.2 with the Microsoft style, pinned as a release-URL package** (v0.14.2 in `Packages`). `vale sync` materializes it into the gitignored styles path. The committed pieces are the vocabulary and the house style.
- **Every Microsoft rule runs at error level.** The maintainer chose full promotion over an error-only gate after seeing the measured cost: 2,300 fixes across 51 files. Two rules stay off with his approval: `Microsoft.Avoid`, because "backend" is house domain language (the safeStorage backend), and `Microsoft.HeadingColons`, because headings keep brand casing like jscpd and pnpm after a colon.
- **One promotion didn't survive the evidence.** `Microsoft.Vocab` is advisory by design: its own message says "verify your use" against the A-Z word list. Treating it as an error forced semantic damage. It rewrote "verified against a checksum" into "verified next to a checksum" and renamed the forbidden-owner-alias concept away from the gitleaks rule that literally carries that name. The reverts landed file by file, and the rule now stays off the gate.
- **House rules, chosen by the maintainer, live in `.vale/styles/recompose/`**: `NoEmDash` bans the em dash outright, and the fix is a rewrite that reads as if the sentence never had one, never a lazy colon patch. `Terminology` pins one name per concept for measured variants such as failover, worktree, and subagent. `WeakOpeners` rejects sentences that open with "there is." `Intensifiers` bans the two stock amplifier adverbs in favor of concrete measures.
- **Scope: every authored markdown file**, covering `docs/`, `README.md`, `CLAUDE.md`, and `.claude/rules/`. Vendored skill content and generated output stay excluded, matching the review-tool path filters.
- **Vocabulary is a reviewed artifact**: case-flexible entries in the committed accept list, extracted from the tree and hand-scanned so a real typo can't hide there. Accept-list entries double as acronym exceptions, which keeps standard names like SHA-256 intact. New words arrive through pull request (PR) diffs like code.
- **Wiring**: a root `lint:prose` script and a lefthook `prose` job. Local tool versions come from `mise.toml`, so hooks are cross-platform and pinned instead of assuming Homebrew, and styles resync whenever `.vale.ini` is newer than the synced directory. A dedicated continuous integration (CI) `prose` job runs behind its own paths filter through the official vale-action, pinned by commit, and joins the `ci-success` needs list per ADR-0007.

## Alternatives

- **Google base style**: the classic developer-docs register, and the original recommendation. The maintainer picked Microsoft because the project's documentation faces outward.
- **Error-only gate**: rejected by the maintainer with the measured cost on the table.
- **Warning-level rollout**: the common adoption advice, but it violates the standing no-advisory-gates rule.
- **Hand-rolled pinned-checksum binary download in CI**: worked, but the maintainer directed the switch to the official action.

## Consequences

- A typo, a banned construction, or terminology drift in authored docs fails pre-commit and CI. The fix is a rewrite or a visible vocabulary addition, each reviewable in the diff.
- The full-strength register reshaped the corpus once: active voice, contractions, split sentences, sentence-case headings, and acronym expansions on first use. Every future document pays the same discipline as it lands.
- The gate flagged its own ADR and the coordinator's CLAUDE.md addition while landing, which is the mechanism working.
- Maintainers inherit two documented false-positive shapes: `Microsoft.Headings` misfires on headings whose parenthetical contains a colon, and `Microsoft.Acronyms` flags stylistic all-caps emphasis as undefined acronyms. Both have cheap rewrites.
- Upgrading the Microsoft package is a deliberate version bump in `.vale.ini`, and new rules arriving with an upgrade must clear the same per-rule curation bar.
