<!-- vale off -->

# Codex ↔ OpenAI Chat Completions parity

Source directory: `internal/translator/codex/openai/chat-completions`.

All 49 upstream tests have direct local behavioral evidence.

| Upstream test                                                                     | Local behavioral evidence                   |
| --------------------------------------------------------------------------------- | ------------------------------------------- |
| `TestToolCallSimple`                                                              | `chat-completions-request.test.ts`          |
| `TestToolCallWithContent`                                                         | `chat-completions-request.test.ts`          |
| `TestToolCallOutputWithMultimodalContent`                                         | `codex-chat-media-parity.test.ts`           |
| `TestToolCallOutputWithStringifiedImageContent`                                   | `codex-chat-media-parity.test.ts`           |
| `TestToolCallOutputKeepsNonImageStrings`                                          | `codex-chat-direct-proof-parity.test.ts`    |
| `TestToolCallOutputFallsBackForInvalidStructuredParts`                            | `codex-chat-media-parity.test.ts`           |
| `TestToolCallOutputWithNonStringJSONContent`                                      | `codex-chat-media-parity.test.ts`           |
| `TestConvertOpenAIRequestToCodexPreservesInputAudio`                              | `codex-chat-direct-proof-parity.test.ts`    |
| `TestMultipleToolCalls`                                                           | `codex-chat-direct-proof-parity.test.ts`    |
| `TestNoSpuriousEmptyAssistantMessage`                                             | `codex-chat-direct-proof-parity.test.ts`    |
| `TestMultiTurnToolCalling`                                                        | `codex-chat-direct-proof-parity.test.ts`    |
| `TestToolNameShortening`                                                          | `provider-request.test.ts`                  |
| `TestCustomToolNameShortening`                                                    | `codex-chat-custom-request-parity.test.ts`  |
| `TestCustomToolShortNameCollisionPreservesFunctionFamily`                         | `codex-chat-custom-request-parity.test.ts`  |
| `TestSameNameCustomAndFunctionDefaultsToFunctionFamily`                           | `codex-chat-custom-request-parity.test.ts`  |
| `TestEmptyStringContent`                                                          | `chat-completions-request.test.ts`          |
| `TestCallIDsMatchBetweenCallAndOutput`                                            | `chat-completions-request.test.ts`          |
| `TestCustomToolCallHistory`                                                       | `codex-chat-custom-request-parity.test.ts`  |
| `TestCustomToolCallResponseFollowUpRoundTrip`                                     | `codex-chat-custom-request-parity.test.ts`  |
| `TestMixedToolCallHistoryPreservesCallFamilies`                                   | `codex-chat-custom-request-parity.test.ts`  |
| `TestToolCallHistoryAllowsReusedCallIDAcrossRounds`                               | `codex-chat-direct-proof-parity.test.ts`    |
| `TestCustomToolCallHistorySynthesizesMissingCallID`                               | `codex-chat-history-repair-parity.test.ts`  |
| `TestToolCallHistoryClearsUnmatchedCallAtNewBatch`                                | `codex-chat-history-repair-parity.test.ts`  |
| `TestToolCallOutputWithoutIDUsesPendingCall`                                      | `codex-chat-history-repair-parity.test.ts`  |
| `TestAmbiguousDuplicateToolCallIDsAreDropped`                                     | `codex-chat-history-repair-parity.test.ts`  |
| `TestOrphanAndDuplicateToolCallOutputsAreDropped`                                 | `codex-chat-history-repair-parity.test.ts`  |
| `TestToolsDefinitionTranslated`                                                   | `chat-completions-request.test.ts`          |
| `TestConvertCodexResponseToOpenAI_IncompleteTerminal`                             | `codex-chat-response-parity.test.ts`        |
| `TestConvertCodexResponseToOpenAI_StreamSetsModelFromResponseCreated`             | `codex-chat-response-parity.test.ts`        |
| `TestConvertCodexResponseToOpenAI_FirstChunkUsesRequestModelName`                 | `gateway-proxy-codex-chat-parity.test.ts`   |
| `TestConvertCodexResponseToOpenAI_ToolCallChunkOmitsNullContentFields`            | `chat-completions-stream-encode.test.ts`    |
| `TestConvertCodexResponseToOpenAI_ToolCallArgumentsDeltaOmitsNullContentFields`   | `chat-completions-stream-encode.test.ts`    |
| `TestConvertCodexResponseToOpenAI_CustomToolCallStreamDeltas`                     | `codex-chat-custom-response-parity.test.ts` |
| `TestConvertCodexResponseToOpenAI_EmptyCustomToolDeltaUsesDoneFallback`           | `codex-chat-custom-response-parity.test.ts` |
| `TestConvertCodexResponseToOpenAI_InterleavedToolCallsKeepStateByItem`            | `codex-chat-custom-response-parity.test.ts` |
| `TestConvertCodexResponseToOpenAI_CustomToolCallInputDoneFallback`                | `codex-chat-custom-response-parity.test.ts` |
| `TestConvertCodexResponseToOpenAI_ToolCallOutputItemDoneFallbacks`                | `codex-chat-custom-response-parity.test.ts` |
| `TestConvertCodexResponseToOpenAINonStream_CustomToolCall`                        | `codex-chat-custom-response-parity.test.ts` |
| `TestConvertCodexResponseToOpenAI_StreamPartialImageEmitsDeltaImages`             | `codex-chat-direct-proof-parity.test.ts`    |
| `TestConvertCodexResponseToOpenAI_StreamImageGenerationCallDoneEmitsDeltaImages`  | `codex-chat-direct-proof-parity.test.ts`    |
| `TestConvertCodexResponseToOpenAI_NonStreamImageGenerationCallAddsMessageImages`  | `codex-chat-media-parity.test.ts`           |
| `TestConvertCodexResponseToOpenAI_StreamForwardsCacheWriteTokens`                 | `codex-chat-cache-parity.test.ts`           |
| `TestConvertCodexResponseToOpenAI_StreamOmitsMissingCacheWriteTokens`             | `codex-chat-cache-parity.test.ts`           |
| `TestConvertCodexResponseToOpenAI_StreamPreservesExplicitZeroCacheWriteTokens`    | `codex-chat-cache-parity.test.ts`           |
| `TestConvertCodexResponseToOpenAI_NonStreamForwardsCacheWriteTokens`              | `codex-chat-cache-parity.test.ts`           |
| `TestConvertCodexResponseToOpenAI_NonStreamOmitsMissingCacheWriteTokens`          | `codex-chat-cache-parity.test.ts`           |
| `TestConvertCodexResponseToOpenAI_NonStreamPreservesExplicitZeroCacheWriteTokens` | `codex-chat-cache-parity.test.ts`           |
| `TestConvertCodexResponseToOpenAI_NonStreamMultiMessageEmptyTrailingKeepsContent` | `codex-chat-response-parity.test.ts`        |
| `TestConvertCodexResponseToOpenAINonStreamKeepsAssistantRole`                     | `chat-completions-response.test.ts`         |
