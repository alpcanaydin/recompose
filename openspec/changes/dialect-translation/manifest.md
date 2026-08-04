---
tier: full
phase: discovery
approvals: ['design']
branch: worktree-dialect-translation
---

# Dialect translation

An engine-internal library translating among three dialects: Anthropic Messages, OpenAI Chat Completions, and OpenAI Responses. Requests, responses, and the event streams all cross. The tier rose from standard to full at the brainstorm. Taking the Responses dialect in added a third event taxonomy and the architecture question a candidate panel owns. The maintainer wants Codex served now, and Codex speaks nothing else since its Chat Completions removal. Pure functions with no fetch and no wiring, and fixtures drive the tests. The parked gateway-virtual-models change consumes the library when it resumes, so the serving path stays untouched here. CLIProxyAPI stands as the reference implementation, and its documented failures join the acceptance criteria.
