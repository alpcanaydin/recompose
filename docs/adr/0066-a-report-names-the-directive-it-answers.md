# 0066: A report names the directive it answers

**Status**: Accepted
**Date**: 2026-08-01

## Context

The main process talks to the engine child over two messages. A directive travels down, and a report travels back. The host held the waiting caller in a map, and the key was the gateway slug. A report naming `codex` answered whatever was waiting on `codex`.

That key is right only while one directive per gateway is ever in flight. A directive that runs out of patience breaks it. The host gives up after five seconds, drops the waiter, and tells the caller the engine never reported. The child hears nothing about that. It keeps working, and it reports when it finishes.

So the late report arrives at a host that already moved on. If a second directive for the same gateway is waiting by then, the slug matches, and the stale report answers it. A start that timed out and finished half a second late would answer the stop that followed it, and the screen would read stopped over a gateway that came up. The ledger took the same value, so the sidebar dot agreed with the lie.

The gateway serial queue (see Architecture Decision Record (ADR) 0058 and the turn order it added) narrows the window without closing it. It keeps two directives for one gateway from going out together, but it can't keep a directive the host abandoned from finishing.

## Decision

**Every directive carries an identifier, and its report echoes it.**

The host stamps `id` on each directive as it goes out, taking it from `randomUUID`. The child copies that value into `answers` on the report it sends back. The schema demands both fields, so neither side can leave the correlation out and still parse.

**The host keys the waiting caller by the identifier, never by the gateway.** It places each report by `answers`, so a report only ever reaches the one caller that asked for it.

**The host drops a report nobody waits on, and writes it down.** An identifier no waiter holds means the host already gave the directive up, or the message strayed in. The host records it and returns. It leaves the ledger alone, because a value nobody asked for is a value nobody can date.

## Consequences

**Good**: a directive that times out can no longer poison the one after it. The ledger only ever moves on an answer someone waits for, so the state on the screen has a directive behind it. A spec now holds the failure the correlation prevents. A given-up start's late report leaves the ledger where it stood, and the stop that followed still gets its own answer.

**Bad**: the protocol carries a field on every message that means nothing to a reader watching one directive go by. Beside a slug in a log line, the identifier reads as noise. A future report the child sends on its own, with no directive behind it, has nowhere to put an identifier, so the host would drop it. Nothing sends one today, and a design that needs one is a design that changes this record.

## Alternatives

**Key the waiter by slug and kind.** A start report answers a start, a stop report answers a stop. It fixes the start-then-stop case in the rider and nothing else, because two starts for one gateway still collide. Rejected as a fix shaped to one reproduction.

**Have the host tell the child to abandon a directive it gave up on.** A cancel message, and a child that drops work in flight. It needs a child that can drop its work partway through binding a port, and it leaves the same race between the cancel and the report crossing. Rejected as more moving parts for a weaker guarantee.

**Let the timeout keep its waiter and answer late.** Never drop the waiter, so the report always finds its caller. It turns a five-second wait into an unbounded one, and a child that never answers holds the caller forever. Rejected because the timeout exists to bound that wait.
