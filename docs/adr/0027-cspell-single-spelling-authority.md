# 0027: cspell is the single spelling authority

**Status**: Accepted
**Date**: 2026-07-24

## Context

No gate read the code's own words. Vale guards prose, but research confirmed its code support stops at comments, and this repository bans comments, so identifiers went unchecked entirely. No human reads this code: a misspelled domain term inside a camelCase identifier becomes permanent vocabulary and breaks one concept, one name. Vale's spell check also overlapped the incoming tool on markdown, and the maintainer chose a single-authority model in the brainstorm rather than two drifting dictionaries.

## Decision

- **cspell 10.0.1 (exact-pinned root devDependency) checks everything**: identifiers, strings, and markdown alike, splitting camelCase and snake_case before lookup. A probe proved the target class:
  <!-- cspell:disable-next-line -->
  `credentailRef` fails with a suggested fix of `credential`.
- **`Vale.Spelling` turns off.** Vale keeps every style, register, and house rule; spelling has exactly one authority and one dictionary. Vale's accept list stays for its separate jobs: casing terms and acronym exceptions.
- **The dictionary is a reviewed artifact**: `cspell-words.txt` at the root, every entry measured from the tree and hand-scanned before acceptance (a fixed count would drift with each addition, as this record's first draft proved). The scan caught one coined word that reads as a typo,
  <!-- cspell:disable-next-line -->
  `re-appliable`, which became a text fix (`re-applicable`) instead of a dictionary entry: fixing prose beats legitimizing a coinage. New words arrive through PR diffs like code.
- **Wiring per the standing rule**: root `lint:spell` script, lefthook `spell` job beside `prose`, and a CI step in both lanes. The `check` job covers code changes, and the `prose` lane gains a pnpm setup plus the same script so documentation-only PRs stay covered too. Both lanes report into the required `ci-success` roll-up.
- **Vendored and generated content stays out** (`ignorePaths` mirrors the other gates: skills, synced styles, lockfiles, generated route trees), and `useGitignore` keeps build output invisible.

## Alternatives

- **Keeping `Vale.Spelling` alongside cspell**: the same typo would fail two gates against two dictionaries with no added protection. Rejected as double bookkeeping.
- **Scope-splitting** (cspell for code, Vale for markdown): every domain word would need maintaining in two lists, and the lists would drift. Rejected in the brainstorm.
- **typos (the Rust checker)**: fast, but it corrects known-bad patterns rather than validating against dictionaries, so a misspelled domain identifier passes unless its typo is famous. The queue's rationale demands dictionary validation.

## Consequences

- A typo anywhere, from an identifier to a README sentence, fails pre-commit and CI with a suggested fix. The escape is a visible dictionary addition reviewed in the diff.
- One dictionary means one place to curate: Vale's accept list no longer grows for spelling reasons.
- Case sensitivity is loose by design in cspell, so a lowercase brand name in prose is Vale's business (Terms), not the spell checker's.
- The compound splitter occasionally needs a dictionary entry for a legitimate fragment, as `McCabe` showed; the reviewed diff keeps such entries honest.
