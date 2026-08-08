<!-- vale off -->

# Runtime executor residual final reconciliation

## Exact residual set

- Pinned upstream: `router-for-me/CLIProxyAPI` commit `8392b180ce3789eba9fd06ebc812b4fc237876e1`.
- Total executor tests: 698.
- Previously accounted family tests: 686.
- Exact residual: 12 tests across four files.
- Final result: **9 covered**, **3 justified N/A**, **0 gaps**.
- No Home, plugin, router, or ledger implementation.

|   # | Upstream test                                                                         | Status  | Recompose evidence                                                                                                                                                                                          |
| --: | ------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   1 | TestEnsureCacheControl                                                                | covered | Automatic Claude cache synthesis adds independent ephemeral breakpoints to the last resident tool, last system block, and second-to-last user turn before existing TTL/order/four-breakpoint normalization. |
|   2 | TestInjectToolsCacheControlSkipsDeferredTools                                         | covered | Tool synthesis selects the last non-deferred tool, skips all-deferred sets, and preserves an existing cache control and TTL.                                                                                |
|   3 | TestCacheControlOrder                                                                 | covered | Direct parity proves only the last tool and last system block receive synthesized controls in tools → system order.                                                                                         |
|   4 | TestEnsureColonSpacedJSONLeavesInvalidPayloadUnchanged                                | N/A     | Recompose rejects malformed JSON at ingress with a request-scoped 400; no byte-format optimization receives invalid payloads.                                                                               |
|   5 | TestNormalizeKimiToolMessageLinksReusesCanonicalPayload                               | covered | Kimi history normalization returns the original body object when every message is already canonical.                                                                                                        |
|   6 | TestNormalizeKimiToolMessageLinksPreservesLargeArguments                              | covered | Kimi normalization leaves arguments unchanged and precise JSON preserves unsafe integer tokens through serialization.                                                                                       |
|   7 | TestCodexMultipartImageEditAppendsExistingImages                                      | covered | Multipart parsing preserves repeated existing `images` references in order and appends uploaded file data URLs.                                                                                             |
|   8 | TestCodexImageBuildersPreservePayloads                                                | covered | Object-based image request/response builders preserve quoted prompts, non-empty image URLs, tool fields, base64 results, revised prompts, and metadata.                                                     |
|   9 | TestSanitizeOpenAIResponsesReasoningEncryptedContent_StripsOrphanIDsWhenStoreDisabled | covered | Store-aware sanitation removes malformed encrypted content and strips IDs from malformed/orphan reasoning when `store=false`, preserving non-reasoning IDs.                                                 |
|  10 | TestSanitizeOpenAIResponsesReasoningEncryptedContent_KeepsIDsWhenStoreEnabled         | covered | With `store=true`, malformed encrypted content is removed while malformed/orphan reasoning IDs remain.                                                                                                      |
|  11 | TestSanitizeOpenAIResponsesReasoningEncryptedContent_NoopReturnsOriginalBody          | N/A     | Semantic no-op preservation is covered, but byte-slice pointer identity is an upstream allocation invariant; Recompose normalizes typed objects and serializes JSON.                                        |
|  12 | TestHomeCodexTerminalStreamFailureUsesFreshDispatchOnNextRequest                      | N/A     | Explicitly excluded Home distributed dispatch behavior; Recompose direct local targets have no Home RPOP dispatcher.                                                                                        |

## Implementation summary

- `claude-cache-control.ts`: idempotent automatic breakpoint synthesis, including deferred-tool and historical-user rules.
- `claude-request.ts`: synthesis runs before existing cache TTL and four-breakpoint enforcement.
- `codex-identities.ts`: pure store-aware Responses reasoning sanitation.
- `gateway-images-body.ts`: existing multipart image references and uploaded images are accumulated together.

## Verification

- Exact upstream non-Home residual selection: 11 tests passed.
- Six exact-named residual parity tests passed.
- Full engine suite: 309 files, 2,177 tests passed.
- Full Oxlint and engine/desktop TypeScript gates passed.
- `git diff --check` and all size/complexity constraints passed.
