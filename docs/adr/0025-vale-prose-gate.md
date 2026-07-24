# ADR-0025: Vale Prose Gate on Authored Documentation

**Status**: Accepted
**Date**: 2026-07-24

## Context

The repository's decision records and README are written once and read forever, mostly by models with no human copyeditor in the loop — a misspelled domain term or drifting terminology quietly becomes permanent vocabulary, the prose equivalent of the one-concept-one-name rule breaking. Nothing machine-checked the prose. The control-gates queue orders a prose linter sixth and asks for a Google-versus-Microsoft decision, a curated day-one-green rule set, and vocabulary aligned with the writing-guidelines skill.

## Decision

- **Vale 3.15.2 with the Google style, pinned as a release URL package** (`errata-ai/Google` v0.6.3 in `Packages`; `vale sync` materializes it into the gitignored `.vale/styles`, committed vocabulary excepted). Google over Microsoft: the house prose is terse developer documentation, which is the register Google's guide targets; Microsoft's consumer-friendliness rules would fight every ADR.
- **Scope: authored prose only** — `docs/adr`, `README.md`, `CLAUDE.md`. Vendored skill content is third-party text (already excluded from review by path filters), and `docs/superpowers` holds approved historical execution artifacts that are amended, not rewritten.
- **Day-one green by curation, not thresholds.** Every deferred rule is named here with its reason:
  - `Google.EmDash` — spaced em-dashes are the house typography, used deliberately across every ADR.
  - `Google.Headings` — ADR titles use title case by house convention.
  - `Google.Colons` — the `**Status**: Accepted` metadata pattern capitalizes after colons by design.
  - `Google.Latin` — `e.g.`/`i.e.` are accepted shorthand in engineering records.
  - `Google.Units` — durations like `3s` are CI-log vocabulary, not narrative units.
  - `Google.LyHyphens` — false positive: the rule matches any `-ly`-ending word, flagging the correct compound `supply-chain`. The three genuine hits it found (`newly-disclosed`, `deliberately-fresh`) were fixed before deferring it.
  - `Google.Quotes` — flags quoted identifiers like `"recompose-design-system"` followed by punctuation; moving the period inside would misquote the name.
- **Vocabulary is a reviewed artifact**: 123 case-flexible entries in `.vale/styles/config/vocabularies/recompose/accept.txt`, extracted from the actual tree and hand-scanned so a real typo cannot hide in the accept list. New words arrive through PR diffs like code.
- **Wiring**: root `lint:prose` script; lefthook `prose` job (installs Vale via brew and syncs styles on first use, the gitleaks pattern); a dedicated CI `prose` job behind a new `prose` paths filter — authored docs never trigger the heavy `check` job, and `check`'s path filter never sees docs — added to `ci-success`'s needs (ADR-0007). The CI binary is downloaded at a pinned version and verified against its published SHA-256 before running.

## Alternatives

- **Microsoft base style** — friendlier consumer tone; its contractions/person rules conflict with record-keeping prose more than Google's.
- **Warning-level rollout** (the common adoption advice) — violates the standing no-advisory-gates rule; curation achieves day-one green at error level instead.
- **errata-ai/vale-action** — official but reviewdog-shaped; an eight-line pinned-checksum download keeps the workflow's third-party action surface unchanged.

## Consequences

- A typo or terminology drift in authored docs fails pre-commit and CI; the fix is a text edit or a visible vocabulary addition, each reviewable in the diff.
- Deferred rules are individually auditable and individually revivable; re-enabling one is a config diff plus the prose cleanup it demands.
- The Google package is fetched by pinned URL; upgrading it is a deliberate version bump in `.vale.ini`, and new rules arriving with an upgrade must clear the same curation bar.
