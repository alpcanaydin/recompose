---
tier: standard
phase: discovery
approvals: []
branch: worktree-dialect-translation
---

# Dialect translation

An engine-internal library translating both ways between the Anthropic Messages dialect and the OpenAI Chat Completions dialect: requests, responses, and the event stream. Pure functions with no fetch and no wiring, and fixtures drive the tests. The parked gateway-virtual-models change consumes the library when it resumes, so the serving path stays untouched here. CLIProxyAPI stands as the reference implementation, and its documented failures join the acceptance criteria.
