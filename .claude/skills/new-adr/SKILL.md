---
name: new-adr
description: Create a new ADR under docs/adr/ with the next sequential number and update the index. Use whenever a technical decision is made (CLAUDE.md requires every decision to be recorded).
---

# New ADR

Create an Architecture Decision Record for the decision given in the arguments.

## Steps

1. Find the next number: `ls docs/adr/ | grep -o '^[0-9]*' | sort -n | tail -1` + 1, zero-padded to 4 digits.
2. Create `docs/adr/NNNN-kebab-case-title.md` in the house format (match existing ADRs):

```markdown
# ADR-NNNN: Title

**Status**: Accepted
**Date**: <today>

## Context

Why this decision was needed. 2-4 sentences, project-specific.

## Decision

What was decided. Plain and direct.

## Alternatives

- **Option**: why it was rejected.

## Consequences

**Good**: concrete benefits.

**Bad**: honest trade-offs and risks, with mitigations if any.
```

3. Add a row to the index table in `docs/adr/README.md` (keep column alignment).
4. Never edit an accepted ADR — supersede: new ADR references the old one, old one's Status becomes `Superseded by ADR-NNNN`.

Keep it under one page. Honest cons over marketing pros.
