---
tier: full
phase: discovery
approvals: []
branch: worktree-gateway-virtual-models
---

# Gateway virtual models

Parked at the end of discovery on 2026-08-04: dialect translation ships first as its own change, and this one resumes on top of it. The locked brainstorm decisions live in discovery/brainstorm-decisions.md. The first composition slice. A person defines a virtual model on a gateway, binds it to exactly one stored target, and picks the real model that target serves it with. The gateway proxies requests arriving under the virtual name to that target, which makes it spend a credential on live traffic for the first time. Subscription accounts never stand as targets. No routers and no canvas: both arrive as their own later features, when topology becomes real.
