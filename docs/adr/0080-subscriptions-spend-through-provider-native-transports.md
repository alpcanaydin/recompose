# 0080: Subscriptions spend through provider-native transports in the engine child

**Status**: Accepted
**Date**: 2026-08-06
**Supersedes**: Decision 0069

## Context

Decision 0069 made subscription accounts custody-only. It required the provider tool to make every inference request. That boundary left a subscription account unusable as a gateway target. CLIProxyAPI demonstrates the requested behavior. When a virtual model targets a subscription, the gateway calls its first-party endpoint. It uses the credential document created by Claude Code or Codex.

The wire identity matters as much as the token. Anthropic observes the Claude Code headers, their order, and the HTTP version. It also observes the Transport Layer Security (TLS) ClientHello. Codex reaches a browser-facing Responses endpoint with first-party client headers and a browser TLS profile. Both providers rotate OAuth refresh tokens. A second writer could restore a stale document or retry with a token that main hasn't stored yet.

Decision 0077 already limits a stored secret in the engine child to one request through a correlated spend grant. Main remains the storage authority, and the engine child remains the only process that opens provider network connections.

## Decision

A subscription is a targetable account. Main resolves it to a per-request subscription spend grant. The grant contains the provider, account ID, origin, and complete native credential document. The credential doesn't enter a gateway start directive or a long-lived serving table.

The engine child sends subscription inference directly. Anthropic requests use the Claude Code Messages URL and ordered first-party headers. They also use HTTP/1.1 and the captured Claude Code TLS controls. OpenAI requests use the ChatGPT Codex Responses URL, Codex client headers, and a fixed Chrome profile. Ordinary keys and local runtimes keep their existing fetch lane.

The engine parses only the fields needed to spend and refresh. It preserves the rest of each native document unchanged. A token within five minutes of expiry refreshes before inference. One unauthorized inference may refresh and retry once. Concurrent refreshes sharing a refresh token collapse into one operation, and a rate-limited refresh isn't immediately replayed.

Every rotated document travels over a correlated child-to-main credential-update lane. Main atomically replaces a file credential. On macOS, it writes the correct active or parked keychain item. The child waits for a durable `stored` acknowledgement before spending the new token. A failed acknowledgement ends the request without retrying inference.

Subscription model listing uses a catalog pinned to the transport fixture revision. Claude uses its shipped registry. Codex filters its registry by the plan claim in the native ID token. Listing doesn't make a provider network request.

## Consequences

**Good**: Claude and Codex subscriptions can back virtual models without spawning either command-line tool. Provider calls remain outside Electron main. Secrets retain the per-request residence established by Decision 0077. Token rotation has one storage authority and a durable-before-spend order. Tests pin the wire identity, refresh behavior, credential preservation, model catalogs, and dialect translation.

**Bad**: recompose reads, spends, refreshes, and rewrites provider-owned OAuth documents. Client versions, private endpoints, headers, model catalogs, and TLS fingerprints can change without notice. The native transport adds platform binaries to packaging. A stale fixture can make a valid subscription fail. Provider parity therefore becomes ongoing maintenance.

## Alternatives

**Keep subscriptions custody-only.** Rejected because a selected subscription would remain an invalid gateway target.

**Spawn Claude Code or Codex for every inference.** Rejected because the gateway needs stable translation, cancellation, streaming, and refusals. Those behaviors belong inside its existing child process. Another subprocess adds a protocol and process lifecycle while still coupling serving to client changes.

**Send subscription traffic from Electron main.** Rejected because main owns storage and interface coordination. The engine child owns outbound provider work. Combining those roles would widen the secret lifetime and the network authority of the privileged process.

**Store only extracted access and refresh tokens.** Rejected because both tools own larger documents. Their identity and account fields must survive rotation. Whole-document preservation also lets a future client add fields without a storage migration.
