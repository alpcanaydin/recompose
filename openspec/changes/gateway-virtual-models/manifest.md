---
tier: full
phase: planning
approvals: ['design']
branch: worktree-gateway-virtual-models
---

# Gateway virtual models

Resumed on 2026-08-06 on top of the shipped dialect-translation library, after the maintainer approved the design at Gate 1. The resumed brainstorm settled the one open question, the refusal statuses, at 404 for an unknown model and 502 for a missing target or a missing credential. The locked brainstorm decisions and that resolution live in discovery/brainstorm-decisions.md, and the proposal and design sit beside this manifest.

The first composition slice. A person defines a virtual model on a gateway, binds it to exactly one stored target, and picks the real model that target serves it with. The gateway proxies requests arriving under the virtual name to that target, which makes it spend a credential on live traffic for the first time. Subscription accounts never stand as targets. No routers and no canvas: both arrive as their own later features, when topology becomes real.
