<!-- vale off -->

# Gemini and AI Studio executor final reconciliation

## Scope and result

- Upstream: `router-for-me/CLIProxyAPI` commit `8392b180ce3789eba9fd06ebc812b4fc237876e1`.
- Gemini executor: **20 covered**, **0 N/A**, **0 gaps**.
- Coupled AI Studio executor: **2 covered**, **0 N/A**, **0 gaps**.
- Combined: **22 covered**, **0 gaps**.
- No plugin, router, or ledger changes.

## Gemini executor — 20 rows

|   # | Upstream test                                                                    | Status  | Recompose evidence                                                                                                                                |
| --: | -------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
|   1 | TestCapGeminiMaxOutputTokensUsesOutputTokenLimit                                 | covered | Known Gemini models clamp `maxOutputTokens` to 65,536 while retaining sibling generation fields.                                                  |
|   2 | TestCapGeminiMaxOutputTokensLeavesAllowedOrUnknown                               | covered | Allowed values and unknown models remain unchanged.                                                                                               |
|   3 | TestGeminiExecutorExecuteCapsMaxOutputTokensBeforeUpstream                       | covered | Gateway integration applies the cap before credentialed spend.                                                                                    |
|   4 | TestGeminiExecutorInteractionsWithGeminiAPIKeyUsesGeminiEndpoint                 | covered | Interactions input translates to Gemini and a normal Gemini key uses `generateContent` without Interactions revision policy.                      |
|   5 | TestGeminiExecutorNativeInteractionsUsesInteractionsEndpoint                     | covered | Native endpoint, agent-only body, default `Api-Revision: 2026-05-20`, and completed response are directly proven.                                 |
|   6 | TestGeminiExecutorNativeInteractionsTranslatesOpenAIResponsesRequest             | covered | Responses input, reasoning fields, completed output, and usage cross native Interactions.                                                         |
|   7 | TestGeminiExecutorNativeInteractionsPayloadRulesUseResponsesFromProtocol         | covered | Structured credential payload overrides match the original `responses` source after translation.                                                  |
|   8 | TestGeminiExecutorNativeInteractionsTranslatesOpenAIChatRequest                  | covered | Chat messages/tools/tool choice and streamed calls cross native Interactions.                                                                     |
|   9 | TestGeminiExecutorNativeInteractionsPayloadDefaultsUseTranslatedOpenAIChatSource | covered | Source-aware defaults match `openai`, preserve translated explicit temperature, and fill absent top-p.                                            |
|  10 | TestGeminiExecutorNativeInteractionsTranslatesGeminiStreamResponse               | covered | Gemini stream calls, signatures, finish reason, and all usage counters round-trip.                                                                |
|  11 | TestNativeInteractionsSourceFormatAllowsSupportedEntryProtocols                  | covered | Interactions, Chat, Responses, Anthropic, and Gemini entry dialects are supported; custody-only formats are excluded.                             |
|  12 | TestGeminiExecutorNativeInteractionsTranslatesClaudeRequest                      | covered | Claude messages/tools and completed usage translate bidirectionally.                                                                              |
|  13 | TestGeminiExecutorNativeInteractionsAppliesThinkingSuffix                        | covered | Shared capability policy strips `(high)`, normalizes the model, and writes native `generation_config.thinking_level` without inventing summaries. |
|  14 | TestGeminiExecutorNativeInteractionsPreservesThinkingProtocolFields              | covered | Native snake-case thinking level/summary fields remain canonical.                                                                                 |
|  15 | TestGeminiExecutorNativeInteractionsPreservesApiRevision                         | covered | Structured Interactions credentials preserve configured API revision metadata.                                                                    |
|  16 | TestGeminiExecutorNativeInteractionsUsesRequestApiRevision                       | covered | Request revision is used when no configured revision exists.                                                                                      |
|  17 | TestGeminiExecutorNativeInteractionsRequestApiRevisionDoesNotOverrideAuthHeader  | covered | Configured revision wins over request revision and configured API key always wins over client auth headers.                                       |
|  18 | TestGeminiExecutorNativeInteractionsStreamParsesUsage                            | covered | Streaming input/output/cached/total usage is retained.                                                                                            |
|  19 | TestGeminiExecutorNativeInteractionsClaudeStreamPreservesToolSignature           | covered | Claude tool signature, Unicode argument delta, and message stop are preserved.                                                                    |
|  20 | TestGeminiExecutorNativeInteractionsResponsesStreamEmitsDone                     | covered | Responses stream emits terminal `[DONE]`.                                                                                                         |

## AI Studio executor — 2 rows

|   # | Upstream test                                                   | Status  | Recompose evidence                                                                         |
| --: | --------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------ |
|  A1 | TestAIStudioTranslateRequestPreservesSummaryFromOriginalRequest | covered | Outbound summary policy reads original request intent and writes Gemini `includeThoughts`. |
|  A2 | TestAIStudioExecutorExecuteStartsTTFTBeforeRelayWait            | covered | Relay timestamps begin at send and TTFT ends on first relay response.                      |

## Implementation summary

- `gemini-interactions-policy.ts`: plain/structured credential parsing, revision precedence, source-protocol payload rules, and post-translation application.
- `reasoning-capabilities.ts`: Interactions/Gemini level and budget output support.
- `credentialed-target.ts`: native Interactions body/header policy integration.
- Plain API-key credentials remain supported unchanged.

## Verification

- Exact upstream selection: Gemini 20 plus AI Studio 2 tests passed.
- Six exact-named residual parity tests passed.
- Full engine suite and gate status is reported in the accompanying handoff.
