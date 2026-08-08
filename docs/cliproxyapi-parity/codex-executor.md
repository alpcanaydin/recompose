<!-- vale off -->

# Codex non-WebSocket executor final reconciliation

## Scope

- Pinned upstream: `router-for-me/CLIProxyAPI` commit `8392b180ce3789eba9fd06ebc812b4fc237876e1`.
- Included: 14 non-WebSocket `codex_executor_*_test.go` and `codex_openai_images*_test.go` files.
- Excluded: every `codex_websockets*` file, plugins, routers, and ledger work.
- Inventory: **101** top-level `Test*` functions.
- Final result: **91 covered**, **10 justified N/A**, **0 gaps**.

N/A is limited to upstream SDK/auth-pool implementation details or router-only scope assertions with no Recompose public equivalent. All transport, request-shaping, image, replay, compact, signature, lifecycle, and native Codex multi-agent invariants in scope are covered.

## Row reconciliation

|   # | Upstream test                                                                             | Status  | Recompose proof cluster                                                                                      |
| --: | ----------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------ |
|   1 | TestCodexExecutorCompactAddsDefaultInstructionsWithoutInjectingImageTool                  | covered | Native `/v1/responses/compact`, compact request normalization, no image injection.                           |
|   2 | TestCodexExecutorCacheHelper_OpenAIChatCompletions_StablePromptCacheKeyFromAPIKey         | N/A     | Upstream per-client SDK API-key identity; Recompose uses explicit gateway session scopes.                    |
|   3 | TestCodexExecutorCacheHelper_UsesDerivedSessionUUID                                       | N/A     | Upstream executor metadata channel is not part of the HTTP gateway contract.                                 |
|   4 | TestCodexExecutorCacheHelper_ClaudeUsesClaudeCodeSessionID                                | covered | Gateway Claude session scope and prompt-cache UUID tests.                                                    |
|   5 | TestCodexExecutorCacheHelper_ClaudeRejectsBareUserID                                      | covered | Parsed JSON session identity only.                                                                           |
|   6 | TestCodexExecutorCacheHelper_IdentityConfuseRemapsBodyAndHeaders                          | N/A     | Auth-pool/fill-first identity confusion is absent from direct targets.                                       |
|   7 | TestApplyCodexHeadersUsesAccountHeaderForOAuth                                            | covered | Codex account header request proofs.                                                                         |
|   8 | TestCodexIdentityConfuseKeepsClientBodySeparateFromUpstreamBody                           | N/A     | Same absent auth-pool identity-confusion feature.                                                            |
|   9 | TestCodexExecutorCacheHelper_ClaudeUsesSessionHeader                                      | covered | Claude session header scope proof.                                                                           |
|  10 | TestCodexExecutorCacheHelper_ClaudeAgentScopeUsesResolvedModelAcrossHTTPAndWebsocket      | covered | Non-WebSocket resolved-model and agent-scope invariant; WebSocket half excluded.                             |
|  11 | TestCodexExecutorDirectOpenAIImageGenerationUsesImagesEndpoint                            | covered | Native image generation gateway test.                                                                        |
|  12 | TestCodexExecutorDirectOpenAIImageGenerationStreamsImagesEndpoint                         | covered | Native image SSE passthrough test.                                                                           |
|  13 | TestCodexExecutorDirectOpenAIImageEditUsesImagesEditEndpointForJSON                       | covered | JSON edit reference preservation.                                                                            |
|  14 | TestCodexExecutorDirectOpenAIImageEditUsesImagesEditEndpointForMultipart                  | covered | Multipart-to-data-URL edit conversion.                                                                       |
|  15 | TestCodexExtractImageResults_FromCompletedOutput                                          | covered | Codex image result extraction tests.                                                                         |
|  16 | TestCodexExtractImageResults_FallbackToCollectedItemsOrdered                              | covered | Indexed done-item ordering.                                                                                  |
|  17 | TestCodexExtractImageResults_PrefersCompletedOutputOverItems                              | covered | Completed-output precedence.                                                                                 |
|  18 | TestCodexExtractImageResults_WrongEventType                                               | covered | Wrong-event rejection.                                                                                       |
|  19 | TestCodexExtractImageResults_FallbackList                                                 | covered | Unindexed fallback extraction.                                                                               |
|  20 | TestParseCodexRetryAfter                                                                  | covered | Codex retry metadata tests.                                                                                  |
|  21 | TestNewCodexStatusErrTreatsCapacityAsRetryableRateLimit                                   | covered | Capacity-to-429 normalization.                                                                               |
|  22 | TestNewCodexStatusErrTreatsUsageLimitAsRetryableRateLimit                                 | covered | Usage-limit 429 and delay.                                                                                   |
|  23 | TestIsCodexUsageLimitError                                                                | covered | Nested/top-level usage-limit classification.                                                                 |
|  24 | TestNewCodexStatusErrClassifiesKnownCodexFailures                                         | covered | Stable context/signature/previous/auth codes.                                                                |
|  25 | TestNewCodexStatusErrPreservesUnclassifiedErrors                                          | covered | Byte-preserving unknown error path.                                                                          |
|  26 | TestCodexExecutorExecuteStreamSanitizesOverlongInputItemIDs                               | covered | Codex identity sanitation test.                                                                              |
|  27 | TestNormalizeCodexParallelToolCallsForTools_DropsWhenToolsMissing                         | covered | Provider request parity table.                                                                               |
|  28 | TestNormalizeCodexParallelToolCallsForTools_DropsWhenToolsEmpty                           | covered | Provider request parity table.                                                                               |
|  29 | TestNormalizeCodexParallelToolCallsForTools_PreservesWhenToolsPresent                     | covered | Provider request parity table.                                                                               |
|  30 | TestNormalizeCodexParallelToolCalls_ResponsesLiteMetadataForcesFalse                      | covered | Responses Lite metadata proof.                                                                               |
|  31 | TestNormalizeCodexParallelToolCalls_ResponsesLiteHeaderForcesFalse                        | covered | Responses Lite gateway-header proof.                                                                         |
|  32 | TestCodexExecutorReasoningReplayCacheStoresFinalDoneAndInjectsNextClaudeRequest           | covered | Final done-item replay observer parity.                                                                      |
|  33 | TestCodexExecutorReasoningReplayCacheSharesSameSessionAcrossClientKeys                    | covered | Session-keyed gateway-wide replay.                                                                           |
|  34 | TestCodexExecutorReasoningReplaySessionKeyUsesClaudeCodeJSONSessionID                     | covered | Claude JSON session scope.                                                                                   |
|  35 | TestCodexExecutorReasoningReplaySessionKeyIsolatesClaudeCodeAgents                        | covered | Root/subagent isolation.                                                                                     |
|  36 | TestCodexExecutorReasoningReplaySessionKeyRejectsBareClaudeUserID                         | covered | Bare user rejection.                                                                                         |
|  37 | TestCodexExecutorReasoningReplaySessionKeyCanonicalizesSessionHeaderAliases               | covered | `Session_id`, `session_id`, and `Session-Id` parity test.                                                    |
|  38 | TestCodexExecutorReasoningReplaySessionKeyCanonicalizesWindowHeaderWithPayload            | covered | Window header/payload scope parity.                                                                          |
|  39 | TestCodexExecutorReasoningReplayCacheSharesSameSessionAcrossCodexAuths                    | covered | Replay key excludes credential identity.                                                                     |
|  40 | TestCodexExecutorReasoningReplayCacheDoesNotInjectNativeResponsesRequest                  | covered | Anthropic-source-only replay injection.                                                                      |
|  41 | TestCodexExecutorReasoningReplayCacheDoesNotStoreNativeResponsesRequest                   | covered | Anthropic-source-only observation.                                                                           |
|  42 | TestCodexExecutorReasoningReplayCacheDoesNotDuplicateClaudeClientReasoning                | covered | Valid native reasoning suppresses cache injection.                                                           |
|  43 | TestCodexExecutorReasoningReplayCacheInsertsReasoningBeforeAssistantOutputInClaudeHistory | covered | Assistant-anchor replay test.                                                                                |
|  44 | TestCodexExecutorReasoningReplayCacheExecuteStreamStoresFinalDoneForClaude                | covered | Incremental stream observer parity.                                                                          |
|  45 | TestCodexExecutorReasoningReplayCacheClearsOnNonStreamResponseFailedInvalidSignature      | covered | Invalid-signature-only clear semantics.                                                                      |
|  46 | TestCodexExecutorReasoningReplayCacheClearsOnStreamResponseFailedInvalidSignature         | covered | Streamed invalid-signature clear semantics.                                                                  |
|  47 | TestCodexExecutorReasoningReplayCacheReplaysFunctionCallForClaudeToolResult               | covered | Cached call reconstruction.                                                                                  |
|  48 | TestCodexExecutorReasoningReplayCacheRestoresCumulativeToolTurns                          | covered | Cumulative tool-turn parity.                                                                                 |
|  49 | TestCodexExecutorReasoningReplayCacheRestoresCumulativeAssistantTurns                     | covered | Cumulative assistant turns.                                                                                  |
|  50 | TestCodexExecutorReasoningReplayCacheSkipsDetachedTurnAfterCompaction                     | covered | Detached-turn filtering.                                                                                     |
|  51 | TestCodexExecutorReasoningReplayCacheMatchesNewestDuplicateAssistantAfterCompaction       | covered | Newest duplicate matching.                                                                                   |
|  52 | TestCodexExecutorReasoningReplayCacheUsesRequestPrefixForDuplicateOutOfOrderTurns         | covered | Request-prefix fingerprints.                                                                                 |
|  53 | TestCodexExecutorReasoningReplayCacheDropsFunctionCallWithoutMatchingOutput               | covered | Detached call filtering.                                                                                     |
|  54 | TestCodexExecutorReasoningReplayCacheMatchesShortenedClaudeToolResultCallID               | covered | Bounded call-ID alignment.                                                                                   |
|  55 | TestCodexReplayPrefixFingerprintsMatchesDirectComputation                                 | covered | Direct known-vector fingerprint proof.                                                                       |
|  56 | TestCodexExecutorOptimizeMultiAgentV2                                                     | covered | Execute/stream/compact request optimization and response namespace restoration.                              |
|  57 | TestCodexExecutorIsCompatConvertsAgentMessage                                             | N/A     | Upstream API-key `IsCompat` model mode; Recompose resolves explicit provider dialects.                       |
|  58 | TestCodexExecutorExecuteResponsesLiteHeaderDoesNotInjectImageGenerationTool               | covered | Gateway media parity.                                                                                        |
|  59 | TestCodexExecutorExecuteStreamResponsesLiteHeaderForcesParallelToolCallsFalse             | covered | Gateway media parity.                                                                                        |
|  60 | TestEnsureImageGenerationTool_ResponsesLiteMetadataDoesNotInjectTool                      | covered | Image tool policy tests.                                                                                     |
|  61 | TestEnsureImageGenerationTool_ResponsesLiteBooleanMetadataDoesNotInjectTool               | covered | Image tool policy tests.                                                                                     |
|  62 | TestEnsureImageGenerationTool_ResponsesLiteHeaderDoesNotInjectTool                        | covered | Image tool policy tests.                                                                                     |
|  63 | TestEnsureImageGenerationTool_ResponsesLiteFalseMetadataStillInjectsTool                  | covered | Image tool policy tests.                                                                                     |
|  64 | TestEnsureImageGenerationTool_NoTools                                                     | covered | Default PNG tool injection.                                                                                  |
|  65 | TestEnsureImageGenerationTool_ExistingToolsWithoutImageGen                                | covered | Tool append behavior.                                                                                        |
|  66 | TestEnsureImageGenerationTool_AlreadyPresent                                              | covered | No duplicate image tool.                                                                                     |
|  67 | TestEnsureImageGenerationTool_ImageGenNamespaceDoesNotInjectTool                          | covered | Namespace capability detection.                                                                              |
|  68 | TestEnsureImageGenerationTool_FlattenedImageGenFunctionDoesNotInjectTool                  | covered | Flattened capability detection.                                                                              |
|  69 | TestEnsureImageGenerationTool_SimilarNamespaceStillInjectsTool                            | covered | Exact namespace matching.                                                                                    |
|  70 | TestEnsureImageGenerationTool_EmptyToolsArray                                             | covered | Empty-array injection.                                                                                       |
|  71 | TestEnsureImageGenerationTool_WebSearchAndImageGen                                        | covered | Web search plus image tool.                                                                                  |
|  72 | TestEnsureImageGenerationTool_GPT53CodexSparkDoesNotInjectTool                            | covered | Spark exclusion.                                                                                             |
|  73 | TestEnsureImageGenerationTool_FreeCodexAuthDoesNotInjectTool                              | covered | Free-plan exclusion.                                                                                         |
|  74 | TestTranslateCodexRequestPairReusesEqualPayload                                           | N/A     | Upstream dual-payload translator call-count optimization.                                                    |
|  75 | TestTranslateCodexRequestPairTranslatesDifferentPayloads                                  | N/A     | Same upstream internal translator architecture.                                                              |
|  76 | TestCodexExecutorExecuteNormalizesNullInstructions                                        | covered | Provider request null instruction proof.                                                                     |
|  77 | TestCodexExecutorExecuteStreamNormalizesNullInstructions                                  | covered | Shared streaming request builder.                                                                            |
|  78 | TestCodexExecutorCountTokensTreatsNullInstructionsAsEmpty                                 | N/A     | Recompose Codex count is local over translated Messages input, not executor-native Responses CountTokens.    |
|  79 | TestCodexExecutorDropsInvalidReasoningEncryptedContentFromFinalRequest                    | covered | Encrypted reasoning envelope sanitation.                                                                     |
|  80 | TestCodexExecutorExecuteStreamDropsInvalidReasoningEncryptedContentFromFinalRequest       | covered | Shared stream request sanitation.                                                                            |
|  81 | TestCodexExecutorCompactDropsInvalidReasoningEncryptedContentFromFinalRequest             | covered | Compact request sanitation.                                                                                  |
|  82 | TestCodexExecutorExecute_NonEmptyCompletionOutputHydratesMissingItemID                    | covered | Completion hydration tests.                                                                                  |
|  83 | TestCodexExecutorExecute_EmptyStreamCompletionOutputUsesOutputItemDone                    | covered | Done-item fallback.                                                                                          |
|  84 | TestCodexExecutorExecuteSurfacesTerminalStreamError                                       | covered | Terminal context failure gateway proof.                                                                      |
|  85 | TestCodexExecutorExecuteIncompleteResponseIsSuccessful                                    | covered | Incomplete terminal preservation.                                                                            |
|  86 | TestCodexExecutorExecuteExplicitTerminalFailureIsNotRequestScoped                         | N/A     | `IsRequestScoped` controls upstream auth-pool/router selection; explicit failure handling itself is covered. |
|  87 | TestCodexExecutorExecuteMissingCompletionIsRequestScoped                                  | covered | HTTP 408 with `scope: request`.                                                                              |
|  88 | TestCodexExecutorExecuteStreamMissingCompletionIsRequestScoped                            | covered | SSE error carries status 408 and request scope.                                                              |
|  89 | TestCodexExecutorExecuteStreamExplicitTerminalFailureIsNotSuccessful                      | covered | Explicit terminal interception.                                                                              |
|  90 | TestCodexExecutorTransportFailureBeforeTerminalIsRequestScoped                            | covered | Aggregate and stream transport interruption parity.                                                          |
|  91 | TestCodexExecutorExecuteIgnoresTransportErrorAfterCompletion                              | covered | Terminal short-circuit.                                                                                      |
|  92 | TestCodexExecutorExecuteStreamIgnoresTransportErrorAfterCompletion                        | covered | Streaming terminal short-circuit.                                                                            |
|  93 | TestCodexExecutorExecuteStreamSurfacesTerminalStreamError                                 | covered | Stream terminal failure proof.                                                                               |
|  94 | TestCodexTerminalStreamContextLengthErrFromResponseFailed                                 | covered | Nested failed-event classifier.                                                                              |
|  95 | TestCodexTerminalStreamContextLengthErrFromTopLevelError                                  | covered | Top-level classifier.                                                                                        |
|  96 | TestCodexTerminalStreamContextLengthErrIgnoresOtherTerminalErrors                         | covered | Context classifier separation.                                                                               |
|  97 | TestCodexTerminalStreamErrIgnoresRateLimitTerminalErrors                                  | N/A     | Upstream helper decomposition; Recompose's unified classifier returns the same 429 outcome.                  |
|  98 | TestCodexTerminalFailureErrClassifiesStatus                                               | covered | 400/401/429/502 status classifier.                                                                           |
|  99 | TestCodexTerminalStreamErrHandlesUsageLimitErrorEvent                                     | covered | Direct usage-limit event and retry delay.                                                                    |
| 100 | TestCodexTerminalStreamErrHandlesUsageLimitResponseFailed                                 | covered | Nested failed usage-limit event.                                                                             |
| 101 | TestCodexExecutorExecuteStream_EmptyStreamCompletionOutputUsesOutputItemDone              | covered | Hydrated native Responses stream.                                                                            |

## Final implementation seams

- Replay: done-item collection, 256-turn retention, invalid-signature-only clearing, call reconstruction, bounded IDs, duplicate/compaction matching, and prefix fingerprints.
- Signatures: malformed/non-string reasoning `encrypted_content` and its item ID are removed; valid Codex envelopes and unrelated fields survive.
- Lifecycle: missing completion and pre-terminal transport failures become request-scoped 408 errors in aggregate and streaming forms.
- Compact: `/v1/responses/compact` and `/responses/compact` use native Codex subscription credentials, refresh once on unauthorized, normalize null instructions, preserve input order, suppress image-tool injection, sanitize signatures, and restore multi-agent namespaces.
- Multi-agent: collaboration tools and agent messages are optimized outbound, with `collaboration` restored on execute, streaming, and compact responses.

## Verification

- Exact upstream selection at the pinned commit: 101 tests passed during the audit run.
- Recompose focused Codex parity suites: passed.
- Full engine Vitest, Oxlint, engine TypeScript, desktop node TypeScript, desktop web TypeScript, and `git diff --check`: see the final handoff status accompanying this report.
