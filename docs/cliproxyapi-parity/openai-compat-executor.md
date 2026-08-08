<!-- vale off -->

# Final OpenAI-compatible runtime executor parity reconciliation

Scope: 23 upstream `Test*` functions from OpenAI-compatible compact, tool-result, and directly coupled payload-optimization tests. Compared with Recompose credentialed provider/aggregator paths, Codex compact/images, Kimi normalization, xAI images, SSE hygiene, prompt caching, and tool-result translation. Plugin, router, and Home behavior is excluded.

## Verification

- Upstream exact subset: 23/23 passed.
- Recompose focused suite: 44/44 passed across compact, images, Kimi, SSE hygiene, prompt cache, and tool results.
- Accounting: 23/23 rows exactly once.

## Row reconciliation

|   # | Family                     | Upstream test                                                                    | Status  | Evidence / concrete gap                                                                                                       |
| --: | -------------------------- | -------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
|   1 | Payload normalization      | `TestEnsureColonSpacedJSONLeavesInvalidPayloadUnchanged`                         | Covered | Exact parity test proves invalid JSON returns the original byte buffer unchanged.                                             |
|   2 | Kimi payload normalization | `TestNormalizeKimiToolMessageLinksReusesCanonicalPayload`                        | N/A     | Pointer/allocation reuse is not an observable JavaScript contract; semantic canonical preservation is tested locally.         |
|   3 | Kimi payload normalization | `TestNormalizeKimiToolMessageLinksPreservesLargeArguments`                       | Covered | Exact raw-byte normalizer test preserves an unsafe-large integer while repairing tool and reasoning links.                    |
|   4 | Image payload builders     | `TestCodexMultipartImageEditAppendsExistingImages`                               | Covered | Exact multipart test proves existing image fields precede uploaded file data URLs.                                            |
|   5 | Image payload builders     | `TestCodexImageBuildersPreservePayloads`                                         | Covered | Codex/xAI image tests cover JSON generation, streamed partials, edit model rewriting, multipart files, and response payloads. |
|   6 | Prompt cache               | `TestOpenAICompatExecutorApplyPromptCacheKey`                                    | Covered | Exact test proves generated protocol/model/session-scoped prompt-cache keys.                                                  |
|   7 | Compact                    | `TestOpenAICompatExecutorCompactPassthrough`                                     | Covered | Exact route test proves generic credentialed compact forwarding, model rewrite, and response pass-through.                    |
|   8 | Prompt cache               | `TestOpenAICompatExecutorPromptCacheKeyCallerValueWinsPayloadOverride`           | Covered | Exact test proves an explicit caller cache key wins.                                                                          |
|   9 | Prompt cache               | `TestOpenAICompatExecutorPromptCacheKeyIsModelAndProtocolScoped`                 | Covered | Exact test proves model and source-protocol separation.                                                                       |
|  10 | Prompt cache               | `TestOpenAICompatExecutorPromptCacheKeyUsesConfigIndex`                          | N/A     | Raw CLIProxy config-index identity has no Recompose equivalent.                                                               |
|  11 | Prompt cache               | `TestOpenAICompatExecutorPromptCacheKeyIgnoresConfigIndexForNonConfigAuth`       | N/A     | Raw config-index versus non-config auth distinction has no Recompose equivalent.                                              |
|  12 | Prompt cache               | `TestOpenAICompatExecutorPromptCacheKeyExecute`                                  | Covered | Codex subscription execute/stream tests prove stable prompt-cache injection and compact-stream separation.                    |
|  13 | Prompt cache               | `TestOpenAICompatExecutorPromptCacheKeyExecuteStream`                            | Covered | Codex subscription execute/stream tests prove stable prompt-cache injection and compact-stream separation.                    |
|  14 | Prompt cache               | `TestOpenAICompatExecutorPromptCacheKeyStreamCompactSkipped`                     | Covered | Codex subscription execute/stream tests prove stable prompt-cache injection and compact-stream separation.                    |
|  15 | Images                     | `TestOpenAICompatExecutorImagesGenerationsPassthrough`                           | Covered | Codex/xAI image tests cover JSON generation, streamed partials, edit model rewriting, multipart files, and response payloads. |
|  16 | Images                     | `TestOpenAICompatExecutorImagesGenerationsStreamsUpstream`                       | Covered | Codex/xAI image tests cover JSON generation, streamed partials, edit model rewriting, multipart files, and response payloads. |
|  17 | Images                     | `TestOpenAICompatExecutorImagesEditsMultipartRewritesModel`                      | Covered | Codex/xAI image tests cover JSON generation, streamed partials, edit model rewriting, multipart files, and response payloads. |
|  18 | Images                     | `TestRewriteOpenAICompatImagesMultipartPayloadPreservesStreamAndFileContentType` | Covered | Exact test proves native multipart cloning preserves stream, model, File identity, and MIME type.                             |
|  19 | Payload overrides          | `TestOpenAICompatExecutorPayloadOverrideWinsOverThinkingSuffix`                  | Covered | Exact test proves provider payload override fields apply last.                                                                |
|  20 | Streaming                  | `TestOpenAICompatExecutorStreamRejectsPlainJSONAfterBlankLines`                  | Covered | Stream-hygiene tests reject invalid streaming shapes, ignore keepalive noise, and drop chunks after `[DONE]`.                 |
|  21 | Streaming                  | `TestOpenAICompatExecutorStreamSkipsKeepAliveUntilDataLine`                      | Covered | Stream-hygiene tests reject invalid streaming shapes, ignore keepalive noise, and drop chunks after `[DONE]`.                 |
|  22 | Streaming                  | `TestOpenAICompatExecutorStreamDropsChunksAfterDone`                             | Covered | Stream-hygiene tests reject invalid streaming shapes, ignore keepalive noise, and drop chunks after `[DONE]`.                 |
|  23 | Tool results               | `TestOpenAICompatExecutorToolResultContentByInputModalities`                     | Covered | Tool-result tests preserve text and image/file modalities across OpenAI-compatible translation.                               |

## Summary

- Covered: 20
- Gap: 0
- N/A: 3

## Final scope boundary

All in-scope executor seams are covered. Pointer/allocation identity and raw CLIProxy config-index distinctions remain N/A. Plugin, router, and Home behavior remains excluded.
