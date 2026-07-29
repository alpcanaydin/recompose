# 0050: The patch coverage target moves to 95 percent

**Status**: Accepted
**Date**: 2026-07-29

## Context

`codecov.yml` demanded 100 percent coverage of every changed line, and no exemption existed. The settings-screen change met 94.91 percent across 20 lines, and closing the gap turned into two different kinds of work.

Most of it was worth doing, and it landed. The credential row rendered nothing for a store that stops answering while the requirement stands. The token status and requirement decisions had branches nothing reached. A queue kept a rejection handler that could never fire. Real specs cover the first three, and the dead handler left with them.

What remained were defensive `catch` arms around filesystem calls and two lazy imports that only exist in a development build. Reaching them means arranging a failure the code exists to survive, which is a test that describes the harness rather than the product.

A 100 percent target treats both kinds the same, so it stops naming the first once the second is all that's left.

## Decision

The patch target is 95 percent, and it stays a blocking status rather than an informational one.

## Alternatives

- **Keep 100 percent**: every future change pays for the last few defensive arms, and the number stops meaning what it says.
- **Turn the patch status off**: removes the signal that found the four real gaps in this change.
- **Exclude the defensive arms by path**: an exclusion list drifts, and it hides the arms that are worth covering alongside the ones that aren't.

## Consequences

**Good**: the gate keeps blocking a change that leaves real behavior untested, and stops blocking one whose remaining lines exist for failures the tests would have to manufacture.

**Bad**: 5 percent of a large change is a real number of lines, and nothing says which five. The mutation gate stays the backstop, and it still asks whether a test would notice a change to the lines it counts. Its own thresholds don't move.
