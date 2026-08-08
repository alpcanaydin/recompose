<!-- vale off -->

# Codex ↔ Claude parity

Source directory: `internal/translator/codex/claude`.

| Upstream test                                                                                       | Status  | Local behavior evidence                |
| --------------------------------------------------------------------------------------------------- | ------- | -------------------------------------- |
| `TestConvertClaudeRequestToCodexWithCompatPreservesEmptyThinking`                                   | covered | `codex-claude-request-parity.test.ts`  |
| `TestConvertCodexResponseToClaude_StreamSerializesInterleavedNamedFunctionCalls`                    | covered | `codex-claude-response-parity.test.ts` |
| `TestConvertCodexResponseToClaude_StreamDefersOtherContentUntilFunctionCallsClose`                  | covered | `codex-claude-response-parity.test.ts` |
| `TestConvertCodexResponseToClaude_StreamDeferredTextClosesBeforeThinkingStarts`                     | covered | `codex-claude-response-parity.test.ts` |
| `TestConvertCodexResponseToClaude_StreamTerminalMatchesFunctionCallsByOutputIndex`                  | covered | `codex-claude-response-parity.test.ts` |
| `TestConvertCodexResponseToClaude_StreamTerminalHydratesInterleavedFunctionCalls`                   | covered | `codex-claude-response-parity.test.ts` |
| `TestConvertClaudeRequestToCodex_SystemMessageScenarios`                                            | covered | `codex-claude-request-parity.test.ts`  |
| `TestConvertClaudeRequestToCodex_MessageSystemRoleWrapsAsUserReminder`                              | covered | `codex-claude-request-parity.test.ts`  |
| `TestConvertClaudeRequestToCodex_ParallelToolCalls`                                                 | covered | `codex-claude-request-parity.test.ts`  |
| `TestConvertClaudeRequestToCodex_ServiceTier`                                                       | covered | `codex-claude-request-parity.test.ts`  |
| `TestConvertClaudeRequestToCodex_ShortenLongToolUseIDs`                                             | covered | `codex-claude-request-parity.test.ts`  |
| `TestConvertClaudeRequestToCodex_ToolChoiceModeMapping`                                             | covered | `codex-claude-request-parity.test.ts`  |
| `TestConvertClaudeRequestToCodex_ToolChoiceSpecificFunctionUsesConvertedName`                       | covered | `codex-claude-request-parity.test.ts`  |
| `TestConvertClaudeRequestToCodex_WebSearchToolMapping`                                              | covered | `codex-claude-request-parity.test.ts`  |
| `TestConvertClaudeRequestToCodex_WebSearchToolChoiceUsesDeclaredTypedToolName`                      | covered | `codex-claude-request-parity.test.ts`  |
| `TestConvertClaudeRequestToCodex_AssistantThinkingSignatureToReasoningItem`                         | covered | `codex-claude-request-parity.test.ts`  |
| `TestConvertClaudeRequestToCodex_PreservesBase64PDFDocumentContent`                                 | covered | `codex-claude-request-parity.test.ts`  |
| `TestConvertClaudeRequestToCodex_PreservesContentOrderAcrossToolAndReasoningItems`                  | covered | `codex-claude-request-parity.test.ts`  |
| `TestConvertClaudeRequestToCodex_AssistantGrokSignatureToReasoningItem`                             | covered | `codex-claude-request-parity.test.ts`  |
| `TestConvertClaudeRequestToCodex_IgnoresGrokSignatureForNonGrokTargets`                             | covered | `codex-claude-request-parity.test.ts`  |
| `TestConvertClaudeRequestToCodex_IgnoresNonCodexThinkingSignatures`                                 | covered | `codex-claude-request-parity.test.ts`  |
| `TestConvertCodexResponseToClaude_StreamThinkingIncludesSignature`                                  | covered | `codex-claude-response-parity.test.ts` |
| `TestConvertCodexResponseToClaude_StreamCyberPolicyError`                                           | covered | `codex-claude-response-parity.test.ts` |
| `TestConvertCodexResponseToClaude_StreamErrorTypeFallbackMessage`                                   | covered | `codex-claude-response-parity.test.ts` |
| `TestConvertCodexResponseToClaude_StreamThinkingWithoutReasoningItemStillIncludesSignatureField`    | covered | `codex-claude-response-parity.test.ts` |
| `TestConvertCodexResponseToClaude_StreamThinkingKeepsSingleBlockAcrossSummaryParts`                 | covered | `codex-claude-response-parity.test.ts` |
| `TestConvertCodexResponseToClaude_StreamThinkingEmitsSingleSignatureAcrossMultipartReasoning`       | covered | `codex-claude-response-parity.test.ts` |
| `TestConvertCodexResponseToClaude_StreamThinkingNeverEmitsPreContentEncryptedContent`               | covered | `codex-claude-response-parity.test.ts` |
| `TestConvertCodexResponseToClaude_StreamThinkingEmitsOneBlockPerReasoningItem`                      | covered | `codex-claude-response-parity.test.ts` |
| `TestConvertCodexResponseToClaude_StreamThinkingUsesEarlyCapturedSignatureWhenDoneOmitsIt`          | covered | `codex-claude-response-parity.test.ts` |
| `TestConvertCodexResponseToClaude_StreamThinkingUsesFinalDoneSignature`                             | covered | `codex-claude-response-parity.test.ts` |
| `TestConvertCodexResponseToClaude_StreamSignatureOnlyReasoningEmitsThinkingSignature`               | covered | `codex-claude-response-parity.test.ts` |
| `TestConvertCodexResponseToClaudeNonStream_ThinkingIncludesSignature`                               | covered | `codex-claude-response-parity.test.ts` |
| `TestConvertCodexResponseToClaude_StreamTextBeforeToolCallsDoesNotEmitGhostStop`                    | covered | `codex-claude-response-parity.test.ts` |
| `TestConvertCodexResponseToClaude_StreamFunctionCallDefersStartUntilDoneName`                       | covered | `codex-claude-response-parity.test.ts` |
| `TestConvertCodexResponseToClaude_StreamUnnamedFunctionCallDoneByCallIDKeepsPendingSlots`           | covered | `codex-claude-response-parity.test.ts` |
| `TestConvertCodexResponseToClaude_StreamDeferredUnnamedFunctionCallDoesNotReserveBlockIndex`        | covered | `codex-claude-response-parity.test.ts` |
| `TestConvertCodexResponseToClaude_StreamTerminalOutputHydratesOpenFunctionCallArguments`            | covered | `codex-claude-response-parity.test.ts` |
| `TestConvertCodexResponseToClaude_StreamTerminalOutputEmitsPendingUnnamedFunctionCall`              | covered | `codex-claude-response-parity.test.ts` |
| `TestConvertCodexResponseToClaude_StreamUnresolvedPendingFunctionCallDoesNotForceToolUseStopReason` | covered | `codex-claude-response-parity.test.ts` |
| `TestConvertCodexResponseToClaude_StreamEmptyOutputUsesOutputItemDoneMessageFallback`               | covered | `codex-claude-response-parity.test.ts` |
| `TestConvertCodexResponseToClaude_StreamWebSearchCallEmitsClaudeServerToolBlocks`                   | covered | `codex-claude-response-parity.test.ts` |
| `TestConvertCodexResponseToClaude_StreamWebSearchCallReusesFallbackToolUseID`                       | covered | `codex-claude-response-parity.test.ts` |
| `TestConvertCodexResponseToClaude_ShortensLongToolUseIDs`                                           | covered | `codex-claude-response-parity.test.ts` |
| `TestConvertCodexResponseToClaude_StreamStopReasonMapping`                                          | covered | `codex-claude-response-parity.test.ts` |
| `TestConvertCodexResponseToClaude_StreamStopSequenceMapping`                                        | covered | `codex-claude-response-parity.test.ts` |
| `TestConvertCodexResponseToClaudeNonStream_WebSearchCallEmitsServerToolBlocks`                      | covered | `codex-claude-response-parity.test.ts` |
| `TestConvertCodexResponseToClaudeNonStream_WebSearchStopReasonEndTurn`                              | covered | `codex-claude-response-parity.test.ts` |
| `TestConvertCodexResponseToClaudeNonStream_WebSearchDedupesEmptyOpenPageItems`                      | covered | `codex-claude-response-parity.test.ts` |
| `TestConvertCodexResponseToClaudeNonStream_StopReasonMapping`                                       | covered | `codex-claude-response-parity.test.ts` |
| `TestConvertCodexResponseToClaudeNonStream_StopSequenceMapping`                                     | covered | `codex-claude-response-parity.test.ts` |
| `TestConvertClaudeRequestToCodexNormalizesNonStringToolName`                                        | covered | `codex-claude-request-parity.test.ts`  |
