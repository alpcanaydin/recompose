# 0082: Gemini is a client and provider dialect

**Status**: Accepted
**Date**: 2026-08-07

## Context

Decision 0075 folds Anthropic, Chat Completions, Responses, and Interactions through one Hub model.
Gemini initially existed only on the provider side: another client dialect could cross into
`generateContent`, and Gemini responses could cross back. That asymmetry left native Gemini clients
unable to select a virtual model. It also left eleven CLIProxyAPI Gemini↔Interactions tests without
an applicable gateway seam.

Gemini requests carry the model identifier in the request path instead of the JSON body. The
`:streamGenerateContent` action selects streaming, although callers may omit a body field. Its
response and error shapes also differ from the OpenAI and Anthropic families.

## Decision

Gemini is a first-class gateway client dialect as well as a provider dialect. It joins the generic
dialect dispatcher with request, response, and stream codecs that fold through the existing Hub.
The design uses the existing Hub without introducing a second canonical message model.

The gateway serves `POST /v1beta/models/{virtual-model}:generateContent` and
`POST /v1beta/models/{virtual-model}:streamGenerateContent`. A single regex route captures the full
action segment, then a parser separates the virtual model from the supported action. The path model
overrides any body model for target lookup. The stream action explicitly sets the crossing's stream
intent.

Native Gemini failures use Gemini's `error.code`, `error.status`, and `error.message` envelope.
Native Gemini streams emit data-only server-sent events. Calls crossing to provider Gemini
continue to use the existing tool-name sanitization and restoration seam.

## Consequences

**Good**: native Gemini SDKs can call virtual models directly. Every supported client/provider pair
uses one typed dispatcher. Gemini request history, media, function identity, generation config,
usage, and stream terminals have behavior tests against the pinned CLIProxyAPI revision.

**Bad**: the public dialect matrix grows from four to five entries. Every provider response and
stream translator must now account for a Gemini client target. Gemini path routing can't reuse the
body-model lookup used by the other dialects.

**Risk**: Gemini may add new action suffixes or alternate stream encodings. The proxy returns 404 for
unsupported actions instead of guessing. The route parser and native codec fixtures must move
together when the gateway intentionally supports a new action.

## Alternatives

**Keep Gemini provider-only.** Rejected because it leaves native Gemini clients and upstream-tested
Gemini request/response conversions unsupported.

**Build a Gemini-specific proxy outside the dispatcher.** Rejected because it would duplicate
routing, refusal, plugin, logging, and provider-spend behavior while creating a second translation
architecture.

**Put the virtual model in the body.** Rejected because native Gemini clients encode it in the URL.
Requiring a non-native body field would break SDK compatibility.
