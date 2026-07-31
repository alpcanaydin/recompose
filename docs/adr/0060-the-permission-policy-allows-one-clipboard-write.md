# 0060: The permission policy allows one clipboard write

**Status**: Accepted
**Date**: 2026-07-31

## Context

Architecture Decision Record (ADR) 0028 set the permission policy to deny every request and every check, without exception. Nothing in the app had ever needed a permission, so the baseline cost nothing to hold.

The gateway toolbar's address pill is the first surface that needs one. A person who can't paste the address can't point a client at the gateway.

## Decision

`permission-policy.ts` allows `clipboard-sanitized-write` and nothing else. The policy spec enumerates the allowed set, so a second allow can't arrive without a failing test that names it. This record amends the baseline ADR-0028 set rather than sitting beside it.

The address carries no secret, so the copy affordance runs in the renderer. The vault route through main that ADR-0047 opened stays scoped to secrecy.

## Alternatives

- **Routing the copy through main**: holds the baseline at zero cost, but spends the secret-bearing route on public text and widens the channel surface.
- **Keeping the deny and shipping no copy affordance**: leaves a person retyping an address off a pill.
- **`document.execCommand('copy')`**: deprecated machinery adopted to dodge a one-line policy statement.

## Consequences

**Good**: the allow is one named permission, and Chromium gates it behind a user gesture regardless. The enumerated set makes every later widening visible in a diff.

**Bad**: the baseline stops reading as absolute, and the next contributor meets a policy with exceptions rather than a rule. The enumeration is what keeps that honest.
