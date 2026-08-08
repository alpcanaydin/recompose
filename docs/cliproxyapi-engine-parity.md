<!-- vale off -->

# CLIProxyAPI engine parity

This document is the audit ledger for the CLIProxyAPI engine port. It records evidence, not an
assumption that similarly named code is equivalent.

## Authority and scope

- Upstream: CLIProxyAPI v7.2.121
- Commit: `8392b180ce3789eba9fd06ebc812b4fc237876e1`
- Local comparison date: 2026-08-07
- Upstream internal tests: 329 files, 2,926 `Test*` functions, 16 benchmarks
- Upstream translator tests: 767 `Test*` functions
- Upstream Interactions translator tests: 136 `Test*` functions
- Current Recompose gate: 360 test files, 2,768 passing tests

The final multiplicity-aware inventory audit is published in
`docs/cliproxyapi-parity/internal-completion-audit.md`: all 2,926 upstream `Test*` functions are
accounted exactly once as 2,536 durable parity rows and 390 approved product-boundary exclusions.
No temporary-only or unaccounted rows remain.

`covered` means a local behavior test proves the externally observable contract. `N/A` is reserved
for implementation details that cannot affect Recompose behavior. `open` means completion is not
yet proved. A passing full suite does not convert an `open` row into `covered`.

## Deliberate exclusions

These are product-boundary exclusions, not hidden parity claims:

- router runtime, until the router feature begins; see ADR 0081;
- CLIProxy Home, CLI, and TUI;
- Redis/PostgreSQL distributed coordination;
- plugin host, plugin store, plugin lifecycle, and plugin hook parity for this phase;
- raw management config and auth-file APIs;
- provider OAuth flows for account contracts Recompose does not expose;
- Go allocation, backing-array reuse, and byte-slice identity assertions.

Provider inference, auth behavior used by Recompose accounts, management behavior exposed by the
desktop engine, watchers, media, realtime, logging, metrics, and error semantics remain in scope.

## Non-translator audit queue

The upstream package inventory below prevents translator completion from being mistaken for engine
completion. Counts are `Test*` functions at the pinned commit; each in-scope or mixed package still
needs row-level classification.

| Upstream package           | Tests | Disposition | Recompose scope                                                                   |
| -------------------------- | ----: | ----------- | --------------------------------------------------------------------------------- |
| `internal/runtime`         |   870 | in scope    | provider executors, replay, streaming, WebSocket, media, retry, cache, auth       |
| `internal/pluginhost`      |   211 | excluded    | plugin lifecycle and hook parity deferred from this phase                         |
| `internal/api`             |   199 | mixed       | inference and exposed management behavior in scope; raw config-file APIs excluded |
| `internal/watcher`         |   167 | in scope    | account/config change synthesis and engine updates                                |
| `internal/signature`       |    97 | in scope    | provider reasoning/signature validation and carriers                              |
| `internal/client`          |    82 | in scope    | provider transport, streaming, realtime, and error semantics                      |
| `internal/cache`           |    65 | in scope    | prompt/replay cache behavior used by inference                                    |
| `internal/pluginstore`     |    55 | excluded    | plugin persistence parity deferred from this phase                                |
| `internal/util`            |    54 | mixed       | observable normalization in scope; Go-only allocation helpers excluded            |
| `internal/config`          |    48 | mixed       | runtime/provider semantics in scope; raw CLIProxy config management excluded      |
| `internal/auth`            |    46 | in scope    | account contracts and refresh behavior supported by Recompose                     |
| `internal/store`           |    32 | mixed       | local engine persistence in scope; distributed coordination excluded              |
| `internal/logging`         |    31 | in scope    | request/error/audit logging and redaction                                         |
| `internal/registry`        |    26 | in scope    | provider/model registration behavior                                              |
| `internal/thinking`        |    24 | in scope    | reasoning configuration and compatibility                                         |
| remaining small packages   |    20 | mixed       | HTTP wire/fetch, safe mode, model config, sanitization, and error behavior        |
| Home/CLI/TUI/Redis/plugins |   390 | excluded    | product-boundary exclusions listed above                                          |

The full 167-test watcher family is reconciled in `docs/cliproxyapi-parity/watcher.md`: 47 covered
with direct behavioral evidence, 120 architecture/product-boundary N/A rows, and zero gaps.

The 101-test Codex non-WebSocket runtime executor family is reconciled in
`docs/cliproxyapi-parity/codex-executor.md`: 91 covered, 10 architectural N/A rows, and zero gaps.

The 125-test Antigravity runtime executor family is reconciled in
`docs/cliproxyapi-parity/antigravity-executor.md`: 118 covered, seven external-discovery/Home N/A
rows, and zero gaps.

The 22-test Gemini and AI Studio runtime executor family is reconciled in
`docs/cliproxyapi-parity/gemini-executor.md`: all 22 behaviors covered and zero gaps.

The 28-test Kimi runtime executor family is reconciled in
`docs/cliproxyapi-parity/kimi-executor.md`: 27 covered, one architecture N/A row, and zero gaps.

The 23-test OpenAI-compatible runtime executor family is reconciled in
`docs/cliproxyapi-parity/openai-compat-executor.md`: 20 covered, three architecture N/A rows, and
zero gaps.

The 12-test generic runtime executor residual set is reconciled in
`docs/cliproxyapi-parity/runtime-executor-residual.md`: nine covered, three Home architecture N/A
rows, and zero gaps.

The exact recursive runtime executor inventory is published in
`docs/cliproxyapi-parity/runtime-executor.md`: all 870 upstream tests mapped once, with 755 covered,
115 architecture/product-boundary N/A rows, and zero gaps.

The 91-test Codex/xAI WebSocket realtime executor family is reconciled in
`docs/cliproxyapi-parity/websocket-executor.md`: 88 covered, three architecture exclusions, and
zero gaps.

The 46-test auth family is reconciled in `docs/cliproxyapi-parity/auth.md`: 26 covered, 20 explicit
product-boundary N/A rows, and zero gaps.

The 65-test cache/replay family is reconciled in `docs/cliproxyapi-parity/cache.md`: 40 covered,
25 distributed/Home architecture N/A rows, and zero gaps.

The 82-test provider client family is reconciled in `docs/cliproxyapi-parity/client.md`: 27 covered,
55 architecture/product-boundary N/A rows, and zero gaps.

The 97-test signature family is reconciled in `docs/cliproxyapi-parity/signature.md`: 89 covered,
eight upstream-internal N/A rows, and zero gaps.

The 31-test logging family is reconciled in `docs/cliproxyapi-parity/logging.md`: 12 covered,
19 framework/Home/plugin/CLI N/A rows, and zero gaps.

The 32-test store family is reconciled in `docs/cliproxyapi-parity/store.md`: two local-storage
behavior rows covered, 30 Git/PostgreSQL architecture N/A rows, and zero gaps.

The 199-test API family is reconciled in `docs/cliproxyapi-parity/api.md`: 12 exposed inference/API
behaviors covered, 187 raw-management/Home/plugin architecture N/A rows, and zero gaps.

The 26-test provider registry family is reconciled in `docs/cliproxyapi-parity/registry.md`: 18
covered, eight plugin/router architecture N/A rows, and zero gaps.

The 54-test utility family is reconciled in `docs/cliproxyapi-parity/util.md`: 52 covered, two
Go-specific zero-copy N/A rows, and zero gaps.

The 24-test reasoning/thinking family is reconciled in `docs/cliproxyapi-parity/thinking.md`: all
24 behaviors covered with direct parity tests and zero gaps.

The four-test model capability configuration family is reconciled in
`docs/cliproxyapi-parity/modelconfig.md`: all four behaviors covered and zero gaps.

The 24-test small infrastructure package set is reconciled in
`docs/cliproxyapi-parity/small-packages.md`: 12 covered, 12 management/UI/router/Go-runtime N/A
rows, and zero gaps.

The 48-test runtime configuration family is reconciled in `docs/cliproxyapi-parity/config.md`: 22
covered and 26 typed-storage/Live/Home/plugin/router N/A rows, with zero gaps.

### Antigravity Hub version and user-agent behavior

Source file: `internal/misc/antigravity_version_test.go`.

| Upstream test                                              | Status  | Local behavior evidence                                                   |
| ---------------------------------------------------------- | ------- | ------------------------------------------------------------------------- |
| `TestAntigravityLatestVersionUsesCurrentHubFallback`       | covered | `antigravity-version.test.ts` pins the `2.2.1` fallback                   |
| `TestAntigravityUserAgentUsesHubFamily`                    | covered | `antigravity-version.test.ts` pins the short Hub/platform user agent      |
| `TestAntigravityVersionFromUserAgentParsesHubFamily`       | covered | `antigravity-version.test.ts`                                             |
| `TestAntigravityVersionFromUserAgentParsesLegacyFamily`    | covered | `antigravity-version.test.ts`                                             |
| `TestAntigravityLoadCodeAssistUserAgentUsesShortUA`        | covered | request builder plus `antigravity-version.test.ts`                        |
| `TestAntigravityOnboardUserUserAgentUsesLongUA`            | covered | `antigravity-version.test.ts` adds the Node API-client suffix             |
| `TestFetchAntigravityLatestVersionUsesHubManifest`         | covered | `antigravity-version.test.ts` checks updater headers and manifest parsing |
| `TestFetchAntigravityLatestVersionReturnsHubManifestError` | covered | `antigravity-version.test.ts` checks non-success propagation              |

### Request-fault classification

Source file: `internal/clienterror/client_error_test.go`.

| Upstream test                             | Status | Local behavior evidence                                                                                                        |
| ----------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `TestIsRequestFaultStructuredIdentifiers` | N/A    | Upstream uses this only to rotate among credentials; Recompose targets one explicit account and performs no hidden rotation    |
| `TestIsRequestFault`                      | N/A    | Status/message retry classification belongs to the deferred router/account-selection layer; provider errors still pass through |

### Ordered native HTTP request writes

Source file: `internal/httpwire/ordered_conn_test.go`.

| Upstream test                                                          | Status  | Local behavior evidence                                                                                                   |
| ---------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| `TestOrderedRequestConnReordersKeepAliveRequestsWithoutChangingBodies` | covered | `claude-request.test.ts` pins ordered headers/body; `provider-transport.test.ts` proves the tuple order reaches transport |
| `TestOrderedRequestConnPreservesChunkedBodyAndReordersNextRequest`     | covered | provider transport preserves request bodies and ordered tuples per request                                                |
| `TestOrderedRequestConnReportsPartialBodyWrite`                        | N/A     | socket write accounting is delegated to `node-wreq`; Recompose has no custom connection wrapper                           |
| `TestOrderedRequestConnTracksOnlyWrittenChunkBytesAfterPartialError`   | N/A     | socket write accounting is delegated to `node-wreq`; no Recompose state depends on partial byte counts                    |

### Generic management-asset fetch helper

Source file: `internal/httpfetch/httpfetch_test.go`.

| Upstream test                            | Status  | Local behavior evidence                                                                     |
| ---------------------------------------- | ------- | ------------------------------------------------------------------------------------------- |
| `TestGetBytesReturnsBodyAndSendsHeaders` | covered | `antigravity-version.test.ts` proves configured updater headers and response-body parsing   |
| `TestGetBytesRejectsErrorStatus`         | covered | `antigravity-version.test.ts` proves non-success status propagation                         |
| `TestGetBytesEnforcesMaxSize`            | N/A     | upstream uses the limit for management UI asset downloads, outside the current engine scope |

### Excluded management UI helpers

| Source package          | Upstream test                                          | Status | Architectural reason                                                         |
| ----------------------- | ------------------------------------------------------ | ------ | ---------------------------------------------------------------------------- |
| `internal/safemode`     | `TestExampleAPIKeysDetectsOnlyTemplateValues`          | N/A    | CLIProxy raw-config safe-mode page; Recompose never accepts that config form |
| `internal/safemode`     | `TestExampleAPIKeysIgnoresSimilarValues`               | N/A    | CLIProxy raw-config safe-mode page                                           |
| `internal/safemode`     | `TestExampleAPIKeyWarningPageIncludesManagementButton` | N/A    | CLIProxy management HTML, not desktop engine behavior                        |
| `internal/htmlsanitize` | `TestJSONBodyEscapesStringValues`                      | N/A    | sanitizes JSON embedded into CLIProxy management HTML                        |
| `internal/htmlsanitize` | `TestJSONBodyIfLikelySkipsNonJSONHTML`                 | N/A    | sanitizes CLIProxy management HTML                                           |

### Deferred router weight parsing

| Upstream test              | Status | Architectural reason                                                   |
| -------------------------- | ------ | ---------------------------------------------------------------------- |
| `TestParseValueValidation` | N/A    | credential weighting belongs to the explicitly deferred router feature |

### Claude executor fast-mode failure scope

The complete 202-test Claude runtime executor reconciliation is recorded in
`docs/cliproxyapi-parity/claude-executor.md`: 198 covered and four Go/runtime-specific N/A rows,
with no remaining gaps.

Source files: `internal/runtime/executor/claude_executor_beta_policy_test.go` and
`claude_executor_fast_error_test.go`.

| Upstream test                                                               | Status  | Local behavior evidence              |
| --------------------------------------------------------------------------- | ------- | ------------------------------------ |
| `TestClassifyClaudeUpstreamError_FastModeCreditsIsRequestScoped`            | covered | `claude-fast-failure-parity.test.ts` |
| `TestClassifyClaudeUpstreamError_OtherStatusesUnaffected`                   | covered | `claude-fast-failure-parity.test.ts` |
| `TestClassifyClaudeUpstreamError_RealRateLimitStaysCredentialScoped`        | covered | `claude-fast-failure-parity.test.ts` |
| `TestClaudeExecutorFastHTTPErrorPassesThroughWithoutRetry`                  | covered | `claude-fast-failure-parity.test.ts` |
| `TestClaudeExecutorFastSuccessfulHTTPDecodeErrorDoesNotExposeSuccessStatus` | covered | `claude-fast-failure-parity.test.ts` |
| `TestClaudeExecutorFastTransportErrorIsRequestScopedWithoutRetry`           | covered | `claude-fast-failure-parity.test.ts` |
| `TestClaudeExecutorNonFastErrorKeepsCredentialScopedBehavior`               | covered | `claude-fast-failure-parity.test.ts` |

## Codex ↔ Interactions slice

Source directory: `internal/translator/codex/interactions`.

| Upstream test                                                            | Status  | Local behavior evidence                                                                                                               |
| ------------------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `TestConvertInteractionsRequestToCodexWithToolMessagesDirect`            | covered | `interactions-request.test.ts` restores text, thought, calls, and results; `interactions-tools.test.ts` carries declarations          |
| `TestConvertInteractionsRequestToCodexPreservesNonImageMediaContent`     | covered | `interactions-media.test.ts` covers audio, video, and document Responses fallbacks                                                    |
| `TestConvertInteractionsRequestToCodexPreservesTopLevelThinkingLevel`    | covered | `interactions-request-options.test.ts` maps `thinking_level` to Responses reasoning effort                                            |
| `TestConvertInteractionsRequestToCodexUsesBodyStream`                    | covered | `gateway-proxy-forward.test.ts` proves a body `stream:true` survives request crossing                                                 |
| `TestConvertInteractionsRequestToCodexFunctionDeclarations`              | covered | `interactions-tools.test.ts` flattens declaration aliases, removes `$schema`, closes additional properties, and preserves definitions |
| `TestConvertCodexResponseToInteractionsIncompleteTerminal`               | covered | `interactions-responses-stream-parity.test.ts` covers non-stream and stream incomplete terminals                                      |
| `TestConvertCodexResponseToInteractionsNonStream`                        | covered | `interactions-response.test.ts` covers text, thought, calls, identity, and aggregate usage                                            |
| `TestConvertCodexResponseToInteractionsStream`                           | covered | `interactions-responses-stream-parity.test.ts` covers Responses text deltas crossing Interactions                                     |
| `TestConvertCodexResponseToInteractionsStreamFunctionCallStartHasCallID` | covered | `interactions-responses-stream-parity.test.ts` checks done-only call identity on `step.start`                                         |
| `TestConvertCodexResponseToInteractionsStreamCompletesAfterSteps`        | covered | `interactions-stream-encode.test.ts` checks step order, completion, `done`, and total usage                                           |
| `TestCleanedCodexToolParametersPreservesCanonicalSchema`                 | covered | `tool-schema.test.ts` checks canonical identity plus normalization; `tool-schema-dialects.test.ts` checks each dialect seam           |
| `TestSetInteractionsCodexRawIfDifferentReusesMatchingValue`              | N/A     | Go backing-array reuse only; emitted request value is already covered by request-option tests                                         |

## OpenAI Responses ↔ Interactions slice

Source directory: `internal/translator/openai/interactions/responses`.

| Upstream test                                                                               | Status  | Local behavior evidence                                                                                  |
| ------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------- |
| `TestConvertOpenAIResponsesRequestToInteractions`                                           | covered | request, media, tool-history, schema, and option parity tests compose the full request                   |
| `TestConvertOpenAIResponsesRequestToInteractionsPreservesRequestStream`                     | covered | gateway stream-crossing tests prove the body flag is authoritative                                       |
| `TestConvertOpenAIResponsesRequestToInteractionsPreservesPreviousResponseID`                | covered | `interactions-request-options.test.ts`                                                                   |
| `TestConvertInteractionsRequestToOpenAIResponsesWithToolMessages`                           | covered | `interactions-responses-request-parity.test.ts`                                                          |
| `TestConvertInteractionsRequestToOpenAIResponsesPreservesStringSystemAndThinkingConfig`     | covered | `interactions-request.test.ts` and `interactions-request-options.test.ts`                                |
| `TestConvertInteractionsRequestToOpenAIResponsesPreservesInteractionStream`                 | covered | gateway stream-crossing tests                                                                            |
| `TestConvertInteractionsRequestToOpenAIResponsesPreservesPreviousInteractionID`             | covered | `interactions-request-options.test.ts`                                                                   |
| `TestConvertInteractionsRequestToOpenAIResponsesPreservesToolCallID`                        | covered | `interactions-responses-request-parity.test.ts`                                                          |
| `TestConvertInteractionsRequestToOpenAIResponsesConvertsSimpleTools`                        | covered | `interactions-tools.test.ts` and tool-schema dialect tests                                               |
| `TestConvertInteractionsRequestToOpenAIResponsesConvertsFunctionDeclarationsTools`          | covered | `interactions-tools.test.ts`                                                                             |
| `TestConvertInteractionsRequestToOpenAIResponsesWithImageContent`                           | covered | `interactions-media.test.ts`                                                                             |
| `TestConvertInteractionsRequestToOpenAIResponsesPreservesNonImageMediaContent`              | covered | `interactions-media.test.ts`                                                                             |
| `TestConvertInteractionsRequestToOpenAIResponsesWithAssistantTextContent`                   | covered | `interactions-media.test.ts` model-output case                                                           |
| `TestConvertInteractionsRequestToOpenAIResponsesWithUserObjectContent`                      | covered | `interactions-request.test.ts` user-input case                                                           |
| `TestConvertInteractionsRequestToOpenAIResponsesWithStringFunctionArguments`                | covered | `interactions-responses-request-parity.test.ts`                                                          |
| `TestConvertInteractionsRequestToOpenAIResponsesPreservesExpressibleFields`                 | covered | `interactions-responses-request-parity.test.ts` carries supported fields and drops execution-only fields |
| `TestConvertInteractionsResponseToOpenAIResponsesNonStream`                                 | covered | `interactions-responses-response-parity.test.ts`                                                         |
| `TestConvertInteractionsResponseToOpenAIResponsesStream`                                    | covered | Interactions stream decode plus Responses stream encode lifecycle tests                                  |
| `TestConvertInteractionsResponseToOpenAIResponsesStreamFunctionCallStartArguments`          | covered | `interactions-stream.test.ts` and `responses-stream-encode.test.ts`                                      |
| `TestConvertInteractionsResponseToOpenAIResponsesStreamFunctionCallEmptyArguments`          | covered | `interactions-responses-stream-parity.test.ts` emits `{}` at every terminal carrier                      |
| `TestConvertInteractionsResponseToOpenAIResponsesStreamFunctionCallEventsAreIdempotent`     | covered | `interactions-stream.test.ts` checks repeated start/stop boundaries                                      |
| `TestConvertInteractionsResponseToOpenAIResponsesStreamModelOutputDoneIncludesText`         | covered | `responses-stream-encode.test.ts` checks full text in text, content-part, and output-item done events    |
| `TestConvertInteractionsResponseToOpenAIResponsesStreamPreservesThoughtSignature`           | covered | Interactions thought-signature and Responses reasoning-carrier tests                                     |
| `TestConvertOpenAIResponsesResponseToInteractionsNonStreamFunctionCall`                     | covered | `interactions-responses-response-parity.test.ts`                                                         |
| `TestConvertOpenAIResponsesResponseToInteractionsNonStreamFunctionCallStringArgs`           | covered | `interactions-responses-response-parity.test.ts` parses string arguments                                 |
| `TestConvertOpenAIResponsesResponseToInteractionsNonStreamUsageDetails`                     | covered | `interactions-responses-response-parity.test.ts` checks native and aggregate aliases                     |
| `TestConvertOpenAIResponsesResponseToInteractionsStreamFunctionCallCallID`                  | covered | `interactions-responses-stream-parity.test.ts`                                                           |
| `TestConvertOpenAIResponsesResponseToInteractionsStreamSkipsDoneArgumentsAfterDelta`        | covered | duplicate-argument stream parity test                                                                    |
| `TestConvertOpenAIResponsesResponseToInteractionsStreamSkipsDoneTextAfterDelta`             | covered | duplicate-terminal stream parity test                                                                    |
| `TestConvertOpenAIResponsesResponseToInteractionsStreamSkipsDoneTextAfterUnkeyedDelta`      | covered | duplicate-terminal test uses an unkeyed text delta                                                       |
| `TestConvertOpenAIResponsesResponseToInteractionsStreamCompletedOutputFallback`             | covered | terminal-output fallback test hydrates text and function calls                                           |
| `TestConvertOpenAIResponsesResponseToInteractionsStreamEmitsDone`                           | covered | terminal-output and incomplete-terminal tests require `done`                                             |
| `TestConvertInteractionsResponseToOpenAIResponsesStreamFinishMetadataUsage`                 | covered | alternate-terminal usage plus Responses usage encoder tests                                              |
| `TestConvertOpenAIResponsesResponseToInteractionsStreamCreatedThenDelta`                    | covered | created-lifecycle parity test synthesizes an unannounced text block                                      |
| `TestConvertOpenAIResponsesResponseToInteractionsStreamCompletesAfterSteps`                 | covered | terminal fallback checks ordered steps, completion, and `done`                                           |
| `TestConvertOpenAIResponsesResponseToInteractionsStreamSkipsCompletedTextAfterUnkeyedDelta` | covered | duplicate-terminal unkeyed-delta test                                                                    |

## OpenAI Chat Completions ↔ Interactions slice

Source directory: `internal/translator/openai/interactions/chat-completions`.

| Upstream test                                                            | Status  | Local behavior evidence                                                   |
| ------------------------------------------------------------------------ | ------- | ------------------------------------------------------------------------- |
| `TestConvertInteractionsRequestToOpenAIPreservesExpressibleFields`       | covered | Chat request-option tests carry tool choice, modalities, and service tier |
| `TestConvertOpenAIRequestToInteractionsMapsMessagesToolsAndStream`       | covered | request, schema, option, and gateway stream-crossing tests                |
| `TestConvertOpenAIRequestToInteractionsMapsToolCallsAndResults`          | covered | Chat request tool-history tests plus Interactions request encoding        |
| `TestConvertInteractionsRequestToOpenAIAcceptsImageContent`              | covered | `interactions-media.test.ts`                                              |
| `TestConvertInteractionsRequestToOpenAIPreservesNonImageMediaContent`    | covered | `interactions-media.test.ts`                                              |
| `TestConvertInteractionsRequestToOpenAIWithToolMessagesDirect`           | covered | Chat and Interactions request-history tests                               |
| `TestConvertOpenAIResponseToInteractionsStreamUsageOnlyTerminalChunk`    | covered | Chat stream decode and cross-dialect response parity tests                |
| `TestConvertOpenAIResponseToInteractionsCompletesOnDoneWithoutUsage`     | covered | Chat stream decoder done-terminal test                                    |
| `TestConvertOpenAIResponseToInteractionsStreamCreatedUsesChunkIdentity`  | covered | `interactions-chat-response-parity.test.ts`                               |
| `TestConvertOpenAIResponseToInteractionsNonStreamDirectToolCall`         | covered | `interactions-chat-response-parity.test.ts`                               |
| `TestConvertInteractionsResponseToOpenAIStreamToolCall`                  | covered | Chat stream encoder tool lifecycle tests                                  |
| `TestConvertInteractionsResponseToOpenAIStreamFinishMetadataUsage`       | covered | Chat usage alias, cache, reasoning, total, and cross-dialect stream tests |
| `TestConvertInteractionsResponseToOpenAINonStreamToolCall`               | covered | `interactions-chat-response-parity.test.ts`                               |
| `TestConvertOpenAIRequestToInteractionsNormalizesFileDataURL`            | covered | `interactions-chat-request-parity.test.ts`                                |
| `TestConvertOpenAIRequestToInteractionsPreservesRawFileDataWithMIMEType` | covered | `interactions-chat-request-parity.test.ts`                                |

## Gemini ↔ Interactions slice

Source directory: `internal/translator/gemini/interactions`.

| Upstream test                                                                    | Status  | Local behavior evidence                                |
| -------------------------------------------------------------------------------- | ------- | ------------------------------------------------------ |
| `TestConvertInteractionsRequestToGeminiStringInput`                              | covered | Interactions request and Gemini request parity tests   |
| `TestConvertInteractionsRequestToGeminiSystemAndGenerationConfig`                | covered | Gemini request and generation-config tests             |
| `TestConvertInteractionsRequestToGeminiStringSystemInstruction`                  | covered | `interactions-gemini-request-parity.test.ts`           |
| `TestConvertGeminiRequestToInteractionsStringSystemInstruction`                  | covered | `gemini-native-codec-parity.test.ts`                   |
| `TestConvertGeminiResponseToInteractionsNonStream`                               | covered | Gemini response and Interactions response parity tests |
| `TestConvertGeminiResponseToInteractionsNonStreamSnakeCaseUsage`                 | covered | `interactions-gemini-response-parity.test.ts`          |
| `TestConvertInteractionsResponseToGeminiStreamFunctionCall`                      | covered | native Gemini codec stream parity test                 |
| `TestConvertInteractionsResponseToGeminiStreamFinishMetadataUsage`               | covered | native Gemini finish-metadata test                     |
| `TestConvertInteractionsResponseToGeminiNonStreamFunctionCall`                   | covered | native Gemini non-stream response test                 |
| `TestConvertInteractionsRequestToGeminiTurnInput`                                | covered | Interactions request turn tests                        |
| `TestConvertInteractionsRequestToGeminiTurnArrayInput`                           | covered | Interactions request turn tests                        |
| `TestConvertInteractionsRequestToGeminiPreservesExpressibleTopLevelFields`       | covered | Gemini request-option tests                            |
| `TestConvertInteractionsRequestToGeminiContentInput`                             | covered | Gemini request parity tests                            |
| `TestConvertInteractionsRequestToGeminiContentArrayInput`                        | covered | Gemini request parity tests                            |
| `TestConvertGeminiResponseToInteractionsNonStreamFunctionCall`                   | covered | `interactions-gemini-response-parity.test.ts`          |
| `TestConvertGeminiResponseToInteractionsNonStreamFunctionCallPreservesCallID`    | covered | Gemini response call-id tests                          |
| `TestConvertGeminiResponseToInteractionsStreamFunctionCallCallID`                | covered | Gemini stream tool lifecycle tests                     |
| `TestConvertGeminiResponseToInteractionsStreamFunctionCallThoughtSignature`      | covered | Gemini stream signature tests                          |
| `TestConvertGeminiResponseToInteractionsStreamStepLifecycle`                     | covered | Gemini stream lifecycle tests                          |
| `TestConvertGeminiResponseToInteractionsStreamSnakeCaseUsage`                    | covered | snake-case usage and stream parity tests               |
| `TestConvertGeminiResponseToInteractionsStreamEmitsTerminalOnce`                 | covered | `gemini-stream-parity.test.ts`                         |
| `TestConvertGeminiResponseToInteractionsStreamDoesNotCompleteOnNonTerminalUsage` | covered | Gemini stream source-done lifecycle tests              |
| `TestConvertGeminiResponseToInteractionsStreamIgnoresTrafficOnlyUsageMetadata`   | covered | Gemini stream usage accumulation tests                 |
| `TestConvertGeminiResponseToInteractionsStreamCompletesOnDoneWithoutUsage`       | covered | Gemini source-done terminal test                       |
| `TestConvertInteractionsRequestToGeminiImageContent`                             | covered | `interactions-media.test.ts`                           |
| `TestConvertInteractionsRequestToGeminiModelOutputTypedContent`                  | covered | document URI and model-output media tests              |
| `TestConvertInteractionsRequestToGeminiThoughtTypedContent`                      | covered | thought-media parity test                              |
| `TestConvertGeminiResponseToInteractionsNonStreamImage`                          | covered | Interactions media response test                       |
| `TestConvertInteractionsRequestToGeminiGenerationConfigAllFields`                | covered | `gemini-generation-config.test.ts`                     |
| `TestConvertInteractionsRequestToGeminiGenerationConfigProtocolFields`           | covered | Gemini request-option and generation-config tests      |
| `TestConvertGeminiRequestToInteractionsFunctionCall`                             | covered | native Gemini codec request parity test                |
| `TestConvertGeminiRequestToInteractionsTextContentType`                          | covered | native Gemini multimodal request test                  |
| `TestConvertGeminiRequestToInteractionsMultimodal`                               | covered | native Gemini multimodal request test                  |
| `TestConvertGeminiRequestToInteractionsThought`                                  | covered | native Gemini thought request test                     |
| `TestConvertInteractionsRequestToGeminiTurnWithModelRole`                        | covered | parent model-turn boundary test                        |
| `TestConvertInteractionsRequestToGeminiGenerationConfigPreservesLargeIntegers`   | covered | precise JSON and generation-config tests               |
| `TestConvertInteractionsRequestToGeminiFunctionCallPreservesCallID`              | covered | Interactions→Gemini call-id test                       |
| `TestConvertInteractionsRequestToGeminiFunctionResultPreservesCallID`            | covered | Interactions→Gemini result-id test                     |
| `TestConvertGeminiRequestToInteractionsFunctionCallPreservesID`                  | covered | native Gemini `id` request case                        |
| `TestConvertGeminiRequestToInteractionsFunctionCallPreservesCallID`              | covered | native Gemini `call_id` request case                   |
| `TestConvertGeminiRequestToInteractionsGenerationConfig`                         | covered | native Gemini generation-config request test           |
| `TestConvertInteractionsRequestToGeminiNormalizesOpenAIFileDataURL`              | covered | nested file-data normalization test                    |

## Antigravity ↔ Interactions slice

Source directory: `internal/translator/antigravity/interactions`.

| Upstream test                                                                  | Status  | Local behavior evidence                                                              |
| ------------------------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------ |
| `TestConvertInteractionsRequestToAntigravityNormalizesOpenAIFileDataURL`       | covered | `interactions-antigravity-parity.test.ts`                                            |
| `TestConvertInteractionsRequestToAntigravityWithToolMessagesDirect`            | covered | full Interactions→Gemini→Antigravity envelope parity test                            |
| `TestConvertInteractionsRequestToAntigravityPreservesGenerationConfig`         | covered | generation controls parity and provider policy tests                                 |
| `TestConvertInteractionsReasoningToAntigravityKeepsSummaryIndependent`         | covered | table-driven summary/effort parity test                                              |
| `TestConvertAntigravityResponseToInteractionsNonStream`                        | covered | response-envelope unwrap and translation test                                        |
| `TestConvertAntigravityResponseToInteractionsStream`                           | covered | stream-envelope unwrap test                                                          |
| `TestConvertAntigravityResponseToInteractionsStreamFunctionCallStartHasCallID` | covered | streamed function-call identity test                                                 |
| `TestConvertInteractionsRequestToAntigravityDeduplicatesAndDisambiguatesTools` | covered | `gemini-tool-names.test.ts`                                                          |
| `TestConvertInteractionsRequestToAntigravityPreservesNameMappingWhitespace`    | covered | whitespace/invalid-character mapping test                                            |
| `TestConvertAntigravityResponseToInteractionsRestoresDisambiguatedName`        | covered | non-stream and stream Gemini name-restoration tests                                  |
| `TestRewriteInteractionsFunctionNamesNormalizesNonStringNames`                 | covered | Interactions ingress and Gemini tool-name normalization test                         |
| `TestRewriteInteractionsFunctionNamesReusesNormalizedPayload`                  | N/A     | Go backing-array reuse only; emitted payload identity is not observable in Recompose |

## Claude ↔ Interactions slice

Source directories: `internal/translator/interactions/claude` and
`internal/translator/claude/interactions`.

| Upstream test                                                                    | Status  | Local behavior evidence                                    |
| -------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------- |
| `TestConvertClaudeRequestToInteractionsWithCompatPreservesEmptyThinking`         | covered | default and compat empty-thinking parity test              |
| `TestConvertClaudeRequestToInteractionsMapsMessagesToolsAndStream`               | covered | Claude request, schema, sampling, and gateway stream tests |
| `TestConvertClaudeRequestToInteractionsMapsToolUseAndResult`                     | covered | Claude tool-history parity test                            |
| `TestConvertInteractionsResponseToClaudeStream`                                  | covered | Interactions text-stream parity test                       |
| `TestConvertInteractionsResponseToClaudeStreamToolCall`                          | covered | Interactions tool-stream parity test                       |
| `TestConvertInteractionsResponseToClaudeStreamFinishMetadataUsage`               | covered | Claude stream usage parity test                            |
| `TestConvertInteractionsResponseToClaudeNonStream`                               | covered | Interactions non-stream response parity test               |
| `TestConvertInteractionsRequestToClaudeWithToolMessagesDirect`                   | covered | Interactions→Claude request history test                   |
| `TestConvertInteractionsRequestToClaudeGroupsConsecutiveRoleTurns`               | covered | Claude turn-grouping parity test                           |
| `TestConvertInteractionsRequestToClaudeDoesNotMergeAcrossRoleChanges`            | covered | role-boundary grouping parity test                         |
| `TestConvertInteractionsRequestToClaudeStringInputDirect`                        | covered | Interactions string-input request test                     |
| `TestConvertInteractionsRequestToClaudeMapsGenerationConfigToolsAndStreamDirect` | covered | sampling, tool-choice, tools, and gateway stream tests     |
| `TestConvertInteractionsRequestToClaudeAcceptsImageContent`                      | covered | Interactions image→Claude request test                     |
| `TestConvertInteractionsRequestToClaudePreservesNonImageMediaContent`            | covered | non-image media request test                               |
| `TestConvertClaudeResponseToInteractionsNonStream`                               | covered | Claude usage/thinking/tool response parity test            |
| `TestConvertClaudeSSEToInteractionsNonStream`                                    | covered | Hub stream collector synthesis test                        |
| `TestConvertClaudeResponseToInteractionsStreamMergesUsageAndStatus`              | covered | Claude stream merge parity test                            |
| `TestConvertClaudeResponseToInteractionsStream`                                  | covered | Claude text-delta stream parity test                       |

## Interactions import boundary

| Upstream test                                             | Status  | Local behavior evidence                                       |
| --------------------------------------------------------- | ------- | ------------------------------------------------------------- |
| `TestInteractionsTranslatorsDoNotImportGeminiTranslators` | covered | `interactions-import-boundary.test.ts` and dependency-cruiser |

## Claude ↔ Chat Completions slice

Source directory: `internal/translator/claude/openai/chat-completions`.

| Upstream test                                                                     | Status  | Local behavior evidence                                     |
| --------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------- |
| `TestConvertOpenAIRequestToClaudeWithCompatPreservesReasoningContent`             | covered | `claude-chat-compat-parity.test.ts`                         |
| `TestConvertOpenAIRequestToClaudeWithCompat_GroupsAssistantThinkingTextAndTools`  | covered | compat assistant-grouping parity test                       |
| `TestConvertOpenAIRequestToClaude_MergesToolResultWithAdjacentUserContent`        | covered | Chat tool-run folding and role merge tests                  |
| `TestConvertOpenAIRequestToClaude_SystemDoesNotBreakUserTurnAndCacheBoundary`     | covered | Chat system/cache boundary tests                            |
| `TestConvertOpenAIRequestToClaude_SanitizesToolCallIDsForClaude`                  | covered | tool-id sanitization tests                                  |
| `TestConvertOpenAIRequestToClaude_GroupsConsecutiveParallelToolResults`           | covered | Chat tool-run grouping tests                                |
| `TestConvertOpenAIRequestToClaude_DropsTemperature`                               | covered | pair-specific Chat→Claude sampling parity test              |
| `TestConvertOpenAIRequestToClaude_ToolResultTextAndBase64Image`                   | covered | Chat tool-result media decoder plus Anthropic encoder tests |
| `TestConvertOpenAIRequestToClaude_ToolResultURLImageOnly`                         | covered | URL image tool-result tests                                 |
| `TestConvertOpenAIRequestToClaude_SystemRoleBecomesTopLevelSystem`                | covered | ordered Hub system-block tests                              |
| `TestConvertOpenAIRequestToClaude_MultipleSystemMessagesMergedIntoTopLevelSystem` | covered | Chat system decode and Anthropic system encode tests        |
| `TestConvertOpenAIRequestToClaude_SystemOnlyInputKeepsFallbackUserMessage`        | covered | `claude-chat-cache-parity.test.ts`                          |
| `TestConvertOpenAIRequestToClaude_PreservesContentPartCacheControl`               | covered | content-part cache tests                                    |
| `TestConvertOpenAIRequestToClaude_PreservesMessageLevelCacheControl`              | covered | message TTL parity test                                     |
| `TestConvertOpenAIRequestToClaude_PreservesToolCacheControl`                      | covered | tool cache parity test                                      |
| `TestConvertOpenAIRequestToClaude_NormalizesRootToolSchemaUnions`                 | covered | root union property-merge tests                             |
| `TestConvertOpenAIRequestToClaude_PartCacheControlWinsOverMessageLevel`           | covered | cache precedence parity test                                |
| `TestConvertOpenAIRequestToClaude_DeveloperRoleBecomesTopLevelSystem`             | covered | developer-system block parity test                          |
| `TestConvertOpenAIRequestToClaude_DeveloperMessageCacheControlAppliesToLastBlock` | covered | developer cache-boundary parity test                        |
| `TestConvertClaudeResponseToOpenAI_StreamUsageIncludesCachedTokens`               | covered | `claude-chat-response-parity.test.ts`                       |
| `TestConvertClaudeResponseToOpenAI_StreamUsageMergesMessageStartUsage`            | covered | Claude stream usage merge test                              |
| `TestConvertClaudeResponseToOpenAINonStream_UsageIncludesCachedTokens`            | covered | Hub stream collector and Chat usage test                    |
| `TestConvertClaudeResponseToOpenAINonStream_UsageMergesMessageStartUsage`         | covered | non-stream collected usage test                             |
| `TestConvertClaudeResponseToOpenAINonStreamFinishReasons`                         | covered | Anthropic stop→Chat finish-reason tests                     |

## Claude ↔ OpenAI Responses slice

Source directory: `internal/translator/claude/openai/responses`.

| Upstream test                                                                                     | Status  | Local behavior evidence                                           |
| ------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------- |
| `TestConvertOpenAIResponsesRequestToClaudeWithCompatPreservesEmptyReasoning`                      | covered | `claude-responses-reasoning-parity.test.ts`                       |
| `TestConvertOpenAIResponsesRequestToClaude_SanitizesToolCallIDsForClaude`                         | covered | Responses history and tool-id tests                               |
| `TestConvertOpenAIResponsesRequestToClaude_ReasoningItemToThinkingBlock`                          | covered | Responses reasoning parity tests                                  |
| `TestConvertOpenAIResponsesRequestToClaude_SignatureOnlyReasoningFlushesBeforeUser`               | covered | signature-only reasoning tests                                    |
| `TestConvertOpenAIResponsesRequestToClaude_RedactedReasoningItemRestoresRedactedThinking`         | covered | Claude redacted marker test                                       |
| `TestConvertOpenAIResponsesRequestToClaude_EmptyRedactedReasoningItemIsDropped`                   | covered | empty redacted reasoning test                                     |
| `TestConvertOpenAIResponsesRequestToClaude_ReasoningContentTextRebuildsThinking`                  | covered | reasoning-content fallback test                                   |
| `TestConvertOpenAIResponsesRequestToClaude_SummaryWinsOverDuplicatedReasoningContent`             | covered | summary precedence test                                           |
| `TestConvertOpenAIResponsesRequestToClaude_DropsIncompatibleReasoningSignature`                   | covered | foreign-signature default test                                    |
| `TestConvertOpenAIResponsesRequestToClaude_GroupsAssistantAndToolResultTurns`                     | covered | `claude-responses-history-parity.test.ts`                         |
| `TestConvertOpenAIResponsesRequestToClaude_MergesConsecutiveUserMessagesAndPreservesCacheControl` | covered | `claude-responses-history-parity.test.ts`                         |
| `TestConvertOpenAIResponsesRequestToClaude_DoesNotMergeAcrossRoleChanges`                         | covered | `claude-responses-history-parity.test.ts`                         |
| `TestConvertOpenAIResponsesRequestToClaude_EmptyStringContentDoesNotBreakAssistantTurn`           | covered | `claude-responses-history-parity.test.ts`                         |
| `TestConvertOpenAIResponsesRequestToClaude_FunctionCallOutputPreservesInputImage`                 | covered | `claude-responses-tool-output-parity.test.ts`                     |
| `TestConvertOpenAIResponsesRequestToClaude_KeepsToolUseAdjacentToToolResult`                      | covered | request history adjacency tests                                   |
| `TestConvertOpenAIResponsesRequestToClaude_DropsApplyPatchCustomTool`                             | covered | extended-tool parity test                                         |
| `TestConvertOpenAIResponsesRequestToClaude_NormalizesRootToolSchemaUnion`                         | covered | strict root-union property tests                                  |
| `TestConvertOpenAIResponsesRequestToClaude_MergesAdditionalToolsAndPrefersTopLevel`               | covered | extended-tool priority test                                       |
| `TestConvertOpenAIResponsesRequestToClaude_DeduplicatesExpandedToolNames`                         | covered | extended-tool dedupe test                                         |
| `TestConvertOpenAIResponsesRequestToClaude_DirectToolWinsOverEarlierNamespaceCollision`           | covered | direct custom collision test                                      |
| `TestConvertOpenAIResponsesRequestToClaude_PrefersDirectToolAcrossAdditionalSources`              | covered | priority-tier normalizer test                                     |
| `TestConvertOpenAIResponsesRequestToClaude_PreservesToolDeclarationOrder`                         | covered | stable selected-tool order test                                   |
| `TestConvertOpenAIResponsesRequestToClaude_ReplaysCustomToolCallHistory`                          | covered | custom history parity test                                        |
| `TestConvertOpenAIResponsesRequestToClaude_ReplaysNamespacedFunctionCallHistory`                  | covered | namespaced history parity test                                    |
| `TestConvertOpenAIResponsesRequestToClaude_MapsCustomAndNamespacedToolChoice`                     | covered | extended tool-choice tests                                        |
| `TestQualifyResponsesNamespaceToolNameAvoidsPrefixCollision`                                      | covered | namespace qualification table test                                |
| `TestSplitResponsesQualifiedFunctionCallFromAdditionalTools`                                      | covered | namespace ref restoration tests                                   |
| `TestConvertOpenAIResponsesRequestToClaude_PreservesContentPartCacheControl`                      | covered | Responses part-cache test                                         |
| `TestConvertOpenAIResponsesRequestToClaude_SystemLevelInputsBecomeSeparateSystemBlocks`           | covered | `claude-responses-system-parity.test.ts`                          |
| `TestConvertOpenAIResponsesRequestToClaude_SystemOnlyInputKeepsFallbackUserMessage`               | covered | system-only fallback test                                         |
| `TestConvertOpenAIResponsesRequestToClaude_SystemNonTextPartKeptAsTypedMarker`                    | covered | typed system marker test                                          |
| `TestConvertOpenAIResponsesRequestToClaude_SystemItemCacheControlAppliesToLastBlock`              | covered | system item cache-boundary test                                   |
| `TestConvertClaudeResponseToOpenAIResponsesNonStreamKeepsZeroUsageDefaults`                       | covered | Responses usage defaults tests                                    |
| `TestConvertClaudeResponseToOpenAIResponses_CreatedIncludesOriginalRequestModel`                  | covered | `responses-attribution.test.ts`; gateway subscription stream test |
| `TestConvertClaudeResponseToOpenAIResponses_ThinkingIncludesSignature`                            | covered | thinking→reasoning stream tests                                   |
| `TestConvertClaudeResponseToOpenAIResponses_RedactedThinkingBecomesMarkedReasoningItem`           | covered | redacted stream carrier tests                                     |
| `TestConvertClaudeResponseToOpenAIResponsesNonStream_RedactedThinkingBecomesMarkedReasoningItem`  | covered | redacted non-stream test                                          |
| `TestConvertClaudeResponseToOpenAIResponses_SuppressesSignatureDeltaPassthrough`                  | covered | signature suppression tests                                       |
| `TestConvertClaudeResponseToOpenAIResponses_AggregatesTextBlocksUntilMessageStop`                 | covered | `claude-responses-stream-lifecycle-parity.test.ts`                |
| `TestConvertClaudeResponseToOpenAIResponses_FinalizesMessageBeforeFunctionCall`                   | covered | `claude-responses-stream-lifecycle-parity.test.ts`                |
| `TestConvertClaudeResponseToOpenAIResponses_UsesContiguousIndicesForReasoningTextAndTool`         | covered | `claude-responses-order-parity.test.ts`                           |
| `TestConvertClaudeResponseToOpenAIResponses_HiddenServerToolsDoNotCreateOutputIndexGaps`          | covered | `claude-responses-stream-lifecycle-parity.test.ts`                |
| `TestConvertClaudeResponseToOpenAIResponses_StartsNewMessageAfterFunctionCall`                    | covered | `claude-responses-stream-lifecycle-parity.test.ts`                |
| `TestConvertClaudeResponseToOpenAIResponses_FinalizesMessageBeforeReasoning`                      | covered | reasoning/text ordering tests                                     |
| `TestConvertClaudeResponseToOpenAIResponses_PreservesMultipleReasoningItems`                      | covered | multiple reasoning output tests                                   |
| `TestConvertClaudeResponseToOpenAIResponses_NormalizesEmptyFunctionArguments`                     | covered | empty argument normalization tests                                |
| `TestConvertClaudeResponseToOpenAIResponses_IncludesEmptyReasoningInCompletedOutput`              | covered | empty reasoning completion tests                                  |
| `TestConvertClaudeResponseToOpenAIResponses_ReportsCacheTokens`                                   | covered | Claude cache usage stream test                                    |
| `TestConvertClaudeResponseToOpenAIResponsesNonStream_ThinkingIncludesSignature`                   | covered | non-stream reasoning signature test                               |
| `TestConvertClaudeResponseToOpenAIResponsesNonStream_PreservesContentBlockOrder`                  | covered | non-stream output ordering test                                   |
| `TestConvertClaudeResponseToOpenAIResponsesNonStream_ReportsCacheTokens`                          | covered | cache-inclusive non-stream usage test                             |
| `TestConvertClaudeResponseToOpenAIResponses_RestoresAdditionalCustomToolCall`                     | covered | custom stream restoration test                                    |
| `TestConvertClaudeResponseToOpenAIResponses_DirectCustomWinsNamespaceCollision`                   | covered | custom collision response test                                    |
| `TestConvertClaudeResponseToOpenAIResponsesNonStream_RestoresAdditionalCustomToolCall`            | covered | non-stream custom restoration test                                |
| `TestConvertClaudeResponseToOpenAIResponses_CustomToolEmptyInputMatchesNonStream`                 | covered | empty custom input tests                                          |
| `TestConvertClaudeResponseToOpenAIResponses_RestoresNamespaceFunctionCall`                        | covered | namespace stream restoration test                                 |
| `TestConvertClaudeResponseToOpenAIResponsesNonStream_RestoresNamespaceFunctionCall`               | covered | namespace non-stream restoration test                             |

## Antigravity ↔ OpenAI Responses slice

Source directory: `internal/translator/antigravity/openai/responses`.

| Upstream test                                                                                                 | Status  | Local behavior evidence                                    |
| ------------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------- |
| `TestConvertOpenAIResponsesRequestToAntigravity_ClaudeReasoningKeepsClaudeSignature`                          | covered | `antigravity-responses-request-parity.test.ts`             |
| `TestConvertOpenAIResponsesRequestToAntigravity_ClaudeReasoningDropsIncompatibleSignature`                    | covered | `antigravity-responses-request-parity.test.ts`             |
| `TestConvertOpenAIResponsesRequestToAntigravity_ClaudeReasoningDropsEmptyThinkingText`                        | covered | `antigravity-responses-request-parity.test.ts`             |
| `TestConvertOpenAIResponsesRequestToAntigravity_EmptyClaudeReasoningDoesNotShiftLaterSignature`               | covered | `antigravity-responses-request-parity.test.ts`             |
| `TestConvertOpenAIResponsesRequestToAntigravity_EmptyClaudeReasoningBeforeFunctionDoesNotShiftLaterSignature` | covered | `antigravity-responses-request-parity.test.ts`             |
| `TestConvertOpenAIResponsesRequestToAntigravity_GeminiReasoningUsesNativeThoughtSignaturePlacement`           | covered | `antigravity-responses-request-parity.test.ts`             |
| `TestConvertAntigravityResponseToOpenAIResponsesNonStream_PreservesOpenAITools`                               | covered | `gateway-proxy-antigravity.test.ts` Responses gateway test |

## OpenAI Chat Completions same-dialect slice

Source directory: `internal/translator/openai/openai/chat-completions`.

| Upstream test                                                | Status  | Local behavior evidence                                                                                |
| ------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------ |
| `TestConvertOpenAIRequestToOpenAIReusesMatchingModelPayload` | N/A     | Go backing-array identity optimization; Recompose serializes a request object at the provider boundary |
| `TestConvertOpenAIRequestToOpenAIUpdatesDifferentModel`      | covered | `gateway-proxy-forward.test.ts` provider-model rewrite assertions                                      |
| `TestConvertOpenAIResponseToOpenAIDropsChunksAfterDone`      | covered | `gateway-proxy-stream-hygiene.test.ts` same-dialect terminal-sentinel test                             |
| `TestConvertOpenAIResponseToOpenAIPassthroughWithoutDone`    | covered | `gateway-proxy-answers.test.ts` same-dialect byte-for-byte answer test                                 |

## OpenAI Chat Completions ↔ Gemini slice

Source directory: `internal/translator/openai/gemini`.

| Upstream test                                                                     | Status  | Local behavior evidence        |
| --------------------------------------------------------------------------------- | ------- | ------------------------------ |
| `TestConvertGeminiRequestToOpenAI_FunctionResponsesConsumeToolCallIDsFIFO`        | covered | `openai-gemini-parity.test.ts` |
| `TestConvertGeminiRequestToOpenAI_FunctionResponseWithoutPriorCallGetsFallbackID` | covered | `openai-gemini-parity.test.ts` |
| `TestConvertGeminiRequestToOpenAI_ExtraFunctionResponsesUseFallbackID`            | covered | `openai-gemini-parity.test.ts` |
| `TestConvertGeminiRequestToOpenAI_PreservesExplicitFunctionCallIDs`               | covered | `openai-gemini-parity.test.ts` |
| `TestConvertGeminiRequestToOpenAI_AcceptsSnakeInlineData`                         | covered | `openai-gemini-parity.test.ts` |
| `TestConvertGeminiRequestToOpenAI_SplitsNonImageInlineDataByMIME`                 | covered | `openai-gemini-parity.test.ts` |
| `TestConvertOpenAIResponseToGeminiNonStreamPreservesToolCallID`                   | covered | `openai-gemini-parity.test.ts` |
| `TestConvertOpenAIResponseToGeminiStreamPreservesToolCallID`                      | covered | `openai-gemini-parity.test.ts` |

## Gemini ↔ Claude slice

Source directory: `internal/translator/gemini/claude`.

| Upstream test                                                                  | Status  | Local behavior evidence                |
| ------------------------------------------------------------------------------ | ------- | -------------------------------------- |
| `TestConvertClaudeRequestToGemini_ToolChoice_SpecificTool`                     | covered | `gemini-claude-request-parity.test.ts` |
| `TestConvertClaudeRequestToGemini_StringSystemInstruction`                     | covered | `gemini-claude-request-parity.test.ts` |
| `TestConvertClaudeRequestToGemini_ImageContent`                                | covered | `gemini-claude-request-parity.test.ts` |
| `TestConvertClaudeRequestToGemini_StripsClaudeCodeAttribution`                 | covered | `gemini-claude-request-parity.test.ts` |
| `TestConvertClaudeRequestToGemini_ConvertsMessageSystemRoleToUserContent`      | covered | `gemini-claude-request-parity.test.ts` |
| `TestConvertClaudeRequestToGemini_SkipsEmptyTextParts`                         | covered | `gemini-claude-request-parity.test.ts` |
| `TestConvertClaudeRequestToGemini_StructuredToolResult`                        | covered | `gemini-claude-request-parity.test.ts` |
| `TestConvertClaudeRequestToGemini_StringToolResult`                            | covered | `gemini-claude-request-parity.test.ts` |
| `TestConvertClaudeRequestToGeminiWithCompatPreservesEmptyThinking`             | covered | `gemini-claude-request-parity.test.ts` |
| `TestConvertGeminiResponseToClaude_SignatureOnlyPartDoesNotOpenEmptyTextBlock` | covered | `gemini-claude-stream-parity.test.ts`  |

## Claude ↔ Gemini slice

Source directory: `internal/translator/claude/gemini`.

| Upstream test                                                         | Status  | Local behavior evidence                                          |
| --------------------------------------------------------------------- | ------- | ---------------------------------------------------------------- |
| `TestConvertGeminiRequestToClaude_PreservesCustomToolIDs`             | covered | `claude-gemini-request-parity.test.ts`                           |
| `TestConvertGeminiRequestToClaude_GroupsConsecutiveRoleTurns`         | covered | `claude-gemini-request-parity.test.ts`                           |
| `TestConvertGeminiRequestToClaude_KeepsSystemInstructionUserSeparate` | covered | `claude-gemini-request-parity.test.ts`                           |
| `TestConvertGeminiRequestToClaude_DropsTemperature`                   | covered | `claude-gemini-request-parity.test.ts`                           |
| `TestConvertGeminiRequestToClaude_AcceptsCamelInlineData`             | covered | `claude-gemini-request-parity.test.ts`                           |
| `TestConvertGeminiRequestToClaude_SplitsNonImageInlineDataByMIME`     | covered | `claude-gemini-request-parity.test.ts`                           |
| `TestNormalizeClaudeToolSchemaPreservesCanonicalSchema`               | covered | `claude-gemini-schema-parity.test.ts`                            |
| `TestNormalizeClaudeToolSchemaCorrectsWrongTypes`                     | covered | `claude-gemini-schema-parity.test.ts`                            |
| `TestLowercaseClaudeToolSchemaTypesReusesLowercaseSchema`             | N/A     | Go backing-array identity optimization; TypeScript emits objects |
| `TestLowercaseClaudeToolSchemaTypesNormalizesNonStringType`           | covered | `claude-gemini-schema-parity.test.ts`                            |
| `TestLowercaseClaudeToolSchemaTypesNormalizesUppercaseTypes`          | covered | `claude-gemini-schema-parity.test.ts`                            |
| `TestConvertClaudeResponseToGemini_StreamPreservesToolUseID`          | covered | `claude-gemini-request-parity.test.ts` stream response case      |
| `TestConvertClaudeResponseToGeminiNonStreamPreservesToolUseID`        | covered | `claude-gemini-request-parity.test.ts` non-stream response case  |

## Codex ↔ Gemini slice

Source directory: `internal/translator/codex/gemini`.

| Upstream test                                                                         | Status  | Local behavior evidence                |
| ------------------------------------------------------------------------------------- | ------- | -------------------------------------- |
| `TestConvertGeminiRequestToCodex_PreservesCustomCallIDs`                              | covered | `codex-gemini-request-parity.test.ts`  |
| `TestConvertGeminiRequestToCodex_AcceptsInlineData`                                   | covered | `codex-gemini-request-parity.test.ts`  |
| `TestConvertGeminiRequestToCodex_SplitsNonImageInlineDataByMIME`                      | covered | `codex-gemini-request-parity.test.ts`  |
| `TestCleanGeminiCodexToolParametersPreservesCanonicalSchema`                          | covered | `codex-gemini-request-parity.test.ts`  |
| `TestSetCodexToolChoiceFromGeminiToolConfigReusesAutoChoice`                          | N/A     | Go backing-array identity optimization |
| `TestCleanGeminiCodexToolParametersNormalizesSchema`                                  | covered | `codex-gemini-request-parity.test.ts`  |
| `TestConvertCodexResponseToGemini_IncompleteTerminal`                                 | covered | `codex-gemini-response-parity.test.ts` |
| `TestConvertCodexResponseToGemini_StreamEmptyOutputUsesOutputItemDoneMessageFallback` | covered | `codex-gemini-response-parity.test.ts` |
| `TestConvertCodexResponseToGemini_StreamPartialImageEmitsInlineData`                  | covered | `codex-gemini-response-parity.test.ts` |
| `TestConvertCodexResponseToGemini_StreamImageGenerationCallDoneEmitsInlineData`       | covered | `codex-gemini-response-parity.test.ts` |
| `TestConvertCodexResponseToGemini_NonStreamImageGenerationCallAddsInlineDataPart`     | covered | `codex-gemini-response-parity.test.ts` |
| `TestConvertCodexResponseToGemini_StreamPreservesFunctionCallID`                      | covered | `codex-gemini-response-parity.test.ts` |
| `TestConvertCodexResponseToGeminiNonStreamPreservesFunctionCallID`                    | covered | `codex-gemini-response-parity.test.ts` |

## Codex ↔ Claude slice

The 52-test Codex ↔ Claude family is fully classified in
`docs/cliproxyapi-parity/codex-claude.md` with direct request/response parity evidence.

The 49-test Codex ↔ OpenAI Chat Completions family is fully classified in
`docs/cliproxyapi-parity/codex-chat.md` with direct behavioral evidence for every row.

## Codex ↔ OpenAI Responses slice

Source directory: `internal/translator/codex/openai/responses`.

| Upstream test                                                                       | Status  | Local behavior evidence                                        |
| ----------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------- |
| `TestConvertSystemRoleToDeveloper_BasicConversion`                                  | covered | `codex-responses-parity.test.ts`                               |
| `TestConvertSystemRoleToDeveloper_MultipleSystemMessages`                           | covered | `codex-responses-parity.test.ts`                               |
| `TestConvertSystemRoleToDeveloper_NoSystemMessages`                                 | covered | `codex-responses-parity.test.ts`                               |
| `TestConvertSystemRoleToDeveloper_EmptyInput`                                       | covered | `codex-responses-parity.test.ts`                               |
| `TestConvertSystemRoleToDeveloper_NoInputField`                                     | covered | `codex-responses-parity.test.ts`                               |
| `TestConvertOpenAIResponsesRequestToCodex_OriginalIssue`                            | covered | `codex-responses-parity.test.ts` required-controls case        |
| `TestConvertOpenAIResponsesRequestToCodexReusesNormalizedPayload`                   | N/A     | Go backing-array identity; normalized behavior covered locally |
| `TestConvertOpenAIResponsesRequestToCodexNormalizesRequiredFields`                  | covered | `codex-responses-parity.test.ts`                               |
| `TestConvertSystemRoleToDeveloper_AssistantRole`                                    | covered | `codex-responses-parity.test.ts`                               |
| `TestConvertOpenAIResponsesRequestToCodex_NormalizesWebSearchPreview`               | covered | `codex-responses-parity.test.ts`                               |
| `TestConvertOpenAIResponsesRequestToCodex_NormalizesTopLevelToolChoicePreviewAlias` | covered | `codex-responses-parity.test.ts`                               |
| `TestUserFieldDeletion`                                                             | covered | `codex-responses-parity.test.ts` unsupported-fields case       |
| `TestContextManagementCompactionCompatibility`                                      | covered | `codex-responses-parity.test.ts` unsupported-fields case       |
| `TestTruncationRemovedForCodexCompatibility`                                        | covered | `codex-responses-parity.test.ts` unsupported-fields case       |
| `TestConvertCodexResponseToOpenAIResponses_CreatedIncludesOriginalRequestModel`     | covered | `gateway-proxy-codex-responses-parity.test.ts`                 |
| `TestConvertCodexResponseToOpenAIResponsesNonStreamIncomplete`                      | covered | `gateway-proxy-codex-responses-parity.test.ts`                 |

## Gemini ↔ OpenAI Responses slice

The 85-test Gemini ↔ OpenAI Responses family is fully reconciled in
`docs/cliproxyapi-parity/gemini-responses.md`: 84 covered with direct behavioral tests and one
Go-only allocation-shape test marked N/A.

## Gemini ↔ Chat Completions slice

Source directory: `internal/translator/gemini/openai/chat-completions`.

| Upstream test                                                                       | Status  | Local behavior evidence               |
| ----------------------------------------------------------------------------------- | ------- | ------------------------------------- |
| `TestConvertOpenAIRequestToGemini_ToolCallSignatureCompatibility`                   | covered | `gemini-chat-request-parity.test.ts`  |
| `TestConvertGeminiResponseToOpenAIIncludesZeroCompletionTokensWhenMissing`          | covered | `gemini-chat-response-parity.test.ts` |
| `TestConvertGeminiResponseToOpenAINonStreamIncludesZeroCompletionTokensWhenMissing` | covered | `gemini-chat-response-parity.test.ts` |
| `TestGeminiFinishReasonOnlyOnFinalChunk`                                            | covered | `gemini-chat-response-parity.test.ts` |
| `TestConvertOpenAIRequestToGemini_StripsTrailingAssistantPrefill`                   | covered | `gemini-chat-request-parity.test.ts`  |
| `TestConvertOpenAIRequestToGeminiPreservesInputAudio`                               | covered | `gemini-chat-request-parity.test.ts`  |
| `TestConvertOpenAIRequestToGeminiPreservesVideoURL`                                 | covered | `gemini-chat-request-parity.test.ts`  |
| `TestConvertOpenAIRequestToGeminiSkipsEmptyTextPartsWithoutNulls`                   | covered | `gemini-chat-request-parity.test.ts`  |
| `TestConvertOpenAIRequestToGeminiPreservesReasoningContent`                         | covered | `gemini-chat-request-parity.test.ts`  |
| `TestConvertOpenAIRequestToGeminiPreservesReasoningBeforeVisibleContentAndToolCall` | covered | `gemini-chat-request-parity.test.ts`  |
| `TestConvertOpenAIRequestToGeminiSkipsEmptyAssistantMessages`                       | covered | `gemini-chat-request-parity.test.ts`  |
| `TestConvertOpenAIRequestToGeminiMapsMaxTokens`                                     | covered | `gemini-chat-request-parity.test.ts`  |
| `TestConvertOpenAIRequestToGeminiCleansToolSchemaRequiredFields`                    | covered | `gemini-chat-request-parity.test.ts`  |
| `TestConvertOpenAIRequestToGeminiResponseFormatJSONSchema`                          | covered | `gemini-chat-request-parity.test.ts`  |
| `TestConvertOpenAIRequestToGeminiResponseFormatJSONObject`                          | covered | `gemini-chat-request-parity.test.ts`  |
| `TestConvertOpenAIRequestToGeminiResponseFormatJSONSchemaWithoutSchema`             | covered | `gemini-chat-request-parity.test.ts`  |
| `TestConvertOpenAIRequestToGeminiResponseFormatNoOp`                                | covered | `gemini-chat-request-parity.test.ts`  |
| `TestConvertOpenAIRequestToGeminiNormalizesToolNameAndStrict`                       | covered | `gemini-chat-request-parity.test.ts`  |
| `TestConvertGeminiResponseToOpenAINonStreamKeepsAssistantRole`                      | covered | `gemini-chat-response-parity.test.ts` |
| `TestConvertGeminiResponseToOpenAIStreamingSetsAssistantRoleOnce`                   | covered | `gemini-chat-response-parity.test.ts` |
| `TestConvertOpenAIRequestToGeminiNormalizesFileDataURL`                             | covered | `gemini-chat-request-parity.test.ts`  |

## Antigravity ↔ Chat Completions slice

Source directory: `internal/translator/antigravity/openai/chat-completions`.

| Upstream test                                                                                             | Status  | Local behavior evidence                   |
| --------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------- |
| `TestConvertOpenAIRequestToAntigravitySkipsEmptyTextPartsWithoutNulls`                                    | covered | Gemini Chat plus Antigravity parity tests |
| `TestConvertOpenAIRequestToAntigravity_ClaudeModelSanitizesUnsignedReasoningContent`                      | covered | `antigravity-chat-parity.test.ts`         |
| `TestConvertOpenAIRequestToAntigravity_ClaudeModelDropsEmptyAssistantTurnAfterSanitizingReasoningContent` | covered | `antigravity-chat-parity.test.ts`         |
| `TestConvertOpenAIRequestToAntigravityPreservesReasoningContent`                                          | covered | Gemini Chat plus Antigravity parity tests |
| `TestConvertOpenAIRequestToAntigravityPreservesReasoningBeforeVisibleContentAndToolCall`                  | covered | Gemini Chat plus Antigravity parity tests |
| `TestConvertOpenAIRequestToAntigravitySkipsEmptyAssistantMessages`                                        | covered | `gemini-chat-request-parity.test.ts`      |
| `TestConvertOpenAIRequestToAntigravityThinkingAliases`                                                    | covered | `antigravity-chat-parity.test.ts`         |
| `TestConvertOpenAIRequestToAntigravityDeduplicatesAndDisambiguatesTools`                                  | covered | `antigravity-chat-parity.test.ts`         |
| `TestConvertOpenAIRequestToAntigravityMapsToolChoiceModes`                                                | covered | Gemini Chat and request option tests      |
| `TestConvertOpenAIRequestToAntigravityMapsResponseFormatJSONObject`                                       | covered | `antigravity-chat-parity.test.ts`         |
| `TestConvertOpenAIRequestToAntigravityMapsResponseFormatJSONSchema`                                       | covered | `antigravity-chat-parity.test.ts`         |
| `TestConvertOpenAIRequestToAntigravityNormalizesFileDataURL`                                              | covered | `gemini-chat-request-parity.test.ts`      |
| `TestFinishReasonToolCallsNotOverwritten`                                                                 | covered | `gemini-chat-response-parity.test.ts`     |
| `TestFinishReasonStopForNormalText`                                                                       | covered | `gemini-chat-response-parity.test.ts`     |
| `TestFinishReasonMaxTokens`                                                                               | covered | Gemini stream stop mapping tests          |
| `TestToolCallTakesPriorityOverMaxTokens`                                                                  | covered | `antigravity-chat-parity.test.ts`         |
| `TestNoFinishReasonOnIntermediateChunks`                                                                  | covered | `gemini-chat-response-parity.test.ts`     |
| `TestConvertAntigravityResponseToOpenAIIncludesZeroCompletionTokensWhenMissing`                           | covered | `gemini-chat-response-parity.test.ts`     |
| `TestConvertAntigravityResponseToOpenAINonStreamRestoresDisambiguatedName`                                | covered | `antigravity-chat-parity.test.ts`         |
| `TestConvertAntigravityResponseToOpenAINonStreamIncludesReasoningContent`                                 | covered | `antigravity-chat-parity.test.ts`         |
| `TestNormalizeAntigravityOpenAIThinkingConfigReusesCanonicalConfig`                                       | N/A     | Go backing-array identity optimization    |

## OpenAI Chat Completions ↔ Claude slice

Source directory: `internal/translator/openai/claude`.

| Upstream test                                                               | Status  | Local behavior evidence                |
| --------------------------------------------------------------------------- | ------- | -------------------------------------- |
| `TestConvertClaudeRequestToOpenAI_ThinkingToReasoningContent`               | covered | `openai-claude-request-parity.test.ts` |
| `TestConvertClaudeRequestToOpenAI_SignedThinkingCompatibility`              | covered | `openai-claude-request-parity.test.ts` |
| `TestConvertClaudeRequestToOpenAI_UnsignedThinkingOnlyMessageDropped`       | covered | `openai-claude-request-parity.test.ts` |
| `TestConvertClaudeRequestToOpenAI_MessageSystemRoleWrapsAsUserReminder`     | covered | `openai-claude-request-parity.test.ts` |
| `TestConvertClaudeRequestToOpenAI_SystemMessageScenarios`                   | covered | `openai-claude-request-parity.test.ts` |
| `TestConvertClaudeRequestToOpenAI_ToolSchemaAddsMissingObjectProperties`    | covered | `openai-claude-request-parity.test.ts` |
| `TestConvertClaudeRequestToOpenAI_ToolResultOrderAndContent`                | covered | `openai-claude-request-parity.test.ts` |
| `TestConvertClaudeRequestToOpenAI_ToolResultObjectContent`                  | covered | `openai-claude-request-parity.test.ts` |
| `TestConvertClaudeRequestToOpenAI_ToolResultTextAndImageContent`            | covered | `openai-claude-request-parity.test.ts` |
| `TestConvertClaudeRequestToOpenAI_ToolResultURLImageOnly`                   | covered | `openai-claude-request-parity.test.ts` |
| `TestConvertClaudeRequestToOpenAI_AssistantTextToolUseTextOrder`            | covered | `openai-claude-request-parity.test.ts` |
| `TestConvertClaudeRequestToOpenAI_AssistantThinkingToolUseThinkingSplit`    | covered | `openai-claude-request-parity.test.ts` |
| `TestConvertClaudeRequestToOpenAI_StripsClaudeCodeAttribution`              | covered | `openai-claude-request-parity.test.ts` |
| `TestConvertClaudeRequestToOpenAIWithCompatPreservesEmptySignatureThinking` | covered | `openai-claude-request-parity.test.ts` |
| `TestStreaming_LateUsageOnlyDoesNotEmitAfterMessageStop`                    | covered | Chat stream terminal tests             |
| `TestConvertOpenAIResponseToClaude_StreamIgnoresNullToolNameDelta`          | covered | `openai-claude-stream-parity.test.ts`  |
| `TestStreamingTool_EmptyNameThroughout`                                     | covered | `openai-claude-stream-parity.test.ts`  |
| `TestStreamingTool_NullName`                                                | covered | `openai-claude-stream-parity.test.ts`  |
| `TestStreamingTool_NonStringName`                                           | covered | `openai-claude-stream-parity.test.ts`  |
| `TestStreamingTool_RepeatedName`                                            | covered | `openai-claude-stream-parity.test.ts`  |
| `TestStreamingTool_MixedSuppressedAndValid`                                 | covered | `openai-claude-stream-parity.test.ts`  |
| `TestStreamingTool_EmptyIDDeferStart`                                       | covered | `openai-claude-stream-parity.test.ts`  |
| `TestStreamingTool_IDInDeltaWithoutFunction`                                | covered | `openai-claude-stream-parity.test.ts`  |
| `TestStreamingTool_StopReasonWithEmittedTool`                               | covered | `openai-claude-stream-parity.test.ts`  |
| `TestStreamingTool_StopReasonWhenIDNeverArrives`                            | covered | `openai-claude-stream-parity.test.ts`  |
| `TestStreamingTool_BelatedStartsUseOpenAIToolIndexOrder`                    | covered | `openai-claude-stream-parity.test.ts`  |
| `TestStreamingTool_LateIDAfterFinalization`                                 | covered | `openai-claude-stream-parity.test.ts`  |
| `TestStreamingTool_StopReasonMixedSuppressedAndValid`                       | covered | `openai-claude-stream-parity.test.ts`  |

## Antigravity ↔ Gemini slice

Source directory: `internal/translator/antigravity/gemini`.

| Upstream test                                                                                    | Status  | Local behavior evidence                           |
| ------------------------------------------------------------------------------------------------ | ------- | ------------------------------------------------- |
| `TestConvertGeminiRequestToAntigravity_ReplacesClientSignatureOnFunctionCall`                    | covered | Antigravity signature tests                       |
| `TestConvertGeminiRequestToAntigravity_DropsIncompatibleClientSignatureOnTextPart`               | covered | Antigravity signature tests                       |
| `TestConvertGeminiRequestToAntigravity_LeavesUnsignedThoughtPartUnsigned`                        | covered | Antigravity signature tests                       |
| `TestConvertGeminiRequestToAntigravity_SkipsUppercaseClaudeModel`                                | covered | `antigravity-gemini-parity.test.ts`               |
| `TestConvertGeminiRequestToAntigravity_ClaudeModelNormalizesStrictClaudeThoughtSignature`        | covered | `antigravity-gemini-parity.test.ts`               |
| `TestConvertGeminiRequestToAntigravity_ClaudeModelDropsNonStrictEPrefixThoughtSignature`         | covered | `antigravity-gemini-parity.test.ts`               |
| `TestConvertGeminiRequestToAntigravity_ClaudeModelDropsEmptyThoughtText`                         | covered | `antigravity-gemini-parity.test.ts`               |
| `TestConvertGeminiRequestToAntigravity_ClaudeModelStripsUnneededFunctionCallSignature`           | covered | `antigravity-gemini-parity.test.ts`               |
| `TestConvertGeminiRequestToAntigravity_AddSkipSentinelToFunctionCall`                            | covered | Antigravity signature tests                       |
| `TestConvertGeminiRequestToAntigravity_ParallelFunctionCallsOnlyFirstGetsSentinel`               | covered | `antigravity-gemini-parity.test.ts`               |
| `TestFixCLIToolResponse_PreservesFunctionResponseParts`                                          | covered | Antigravity function-history tests                |
| `TestFixCLIToolResponse_BackfillsEmptyFunctionResponseName`                                      | covered | `antigravity-gemini-parity.test.ts`               |
| `TestFixCLIToolResponse_BackfillsMultipleEmptyNames`                                             | covered | Antigravity function-history and provenance tests |
| `TestFixCLIToolResponse_PreservesExistingName`                                                   | covered | Antigravity function-history tests                |
| `TestFixCLIToolResponse_MoreResponsesThanCalls`                                                  | covered | Antigravity function-history tests                |
| `TestFixCLIToolResponse_MultipleGroupsFIFO`                                                      | covered | `antigravity-gemini-parity.test.ts`               |
| `TestConvertGeminiRequestToAntigravityDeduplicatesRequestWideAndDisambiguatesTools`              | covered | Gemini tool-name and Antigravity parity tests     |
| `TestConvertGeminiRequestToAntigravityMapsSnakeCaseFunctionReferences`                           | covered | `antigravity-gemini-parity.test.ts`               |
| `TestSanitizeAntigravityClaudeGeminiRequestSignatures_PreservesNumberPrecision`                  | covered | precise JSON and Antigravity request tests        |
| `TestSanitizeAntigravityClaudeGeminiRequestSignatures_StripsFunctionCallSignatureForClaudeModel` | covered | `antigravity-gemini-parity.test.ts`               |
| `TestRestoreUsageMetadata`                                                                       | covered | Gemini response usage tests                       |
| `TestConvertAntigravityResponseToGeminiNonStream`                                                | covered | Antigravity envelope and Gemini response tests    |
| `TestConvertAntigravityResponseToGeminiNonStreamRestoresDisambiguatedName`                       | covered | Gemini tool-name restoration tests                |
| `TestConvertAntigravityResponseToGeminiStream`                                                   | covered | Antigravity stream envelope tests                 |
| `TestRewriteGeminiFunctionNamesReusesNormalizedPayload`                                          | N/A     | Go backing-array identity optimization            |
| `TestRemoveEmptyGeminiFunctionToolsReusesNormalizedPayload`                                      | N/A     | Go backing-array identity optimization            |
| `TestRemoveEmptyGeminiFunctionToolsDeletesEmptyArray`                                            | covered | Gemini tool normalization tests                   |
| `TestRewriteGeminiFunctionNamesNormalizesNonStringNames`                                         | covered | Gemini tool-name normalization tests              |
| `TestFixCLIToolResponseReusesHistoryWithoutFunctionResponses`                                    | N/A     | Go backing-array identity optimization            |
| `TestFixCLIToolResponsePreservesObjectNormalization`                                             | covered | Antigravity function-history tests                |

## Antigravity ↔ Claude slice

The complete 136-test family is reconciled in
`docs/cliproxyapi-parity/antigravity-claude.md`: 132 covered with direct behavioral evidence and
four upstream-internal contracts marked N/A. No gaps remain.

## OpenAI Responses ↔ Chat Completions slice

Source directory: `internal/translator/openai/openai/responses`.

| Upstream test                                                                                                  | Status  | Local behavior evidence                         |
| -------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------- |
| `TestConvertOpenAIResponsesRequestToOpenAIChatCompletions_MergeConsecutiveFunctionCalls`                       | covered | `openai-responses-chat-request-parity.test.ts`  |
| `TestConvertOpenAIResponsesRequestToOpenAIChatCompletions_SplitFunctionCallsWhenInterrupted`                   | covered | `openai-responses-chat-request-parity.test.ts`  |
| `TestConvertOpenAIResponsesRequestToOpenAIChatCompletions_DefersMessageUntilToolOutput`                        | covered | `openai-responses-chat-request-parity.test.ts`  |
| `TestConvertOpenAIResponsesRequestToOpenAIChatCompletions_UnwrapsStringifiedToolOutputImages`                  | covered | `openai-responses-chat-request-parity.test.ts`  |
| `TestConvertOpenAIResponsesRequestToOpenAIChatCompletions_ConvertsStructuredToolOutputImages`                  | covered | `openai-responses-chat-request-parity.test.ts`  |
| `TestConvertOpenAIResponsesRequestToOpenAIChatCompletions_KeepsNonImageToolOutputStrings`                      | covered | `openai-responses-chat-request-parity.test.ts`  |
| `TestConvertOpenAIResponsesRequestToOpenAIChatCompletions_AttachesReasoningToAssistantMessage`                 | covered | `openai-responses-chat-request-parity.test.ts`  |
| `TestConvertOpenAIResponsesRequestToOpenAIChatCompletions_AttachesReasoningToToolCallMessage`                  | covered | `openai-responses-chat-request-parity.test.ts`  |
| `TestConvertOpenAIResponsesRequestToOpenAIChatCompletions_KeepsReasoningBeforeUserMessage`                     | covered | `openai-responses-chat-request-parity.test.ts`  |
| `TestConvertOpenAIResponsesRequestToOpenAIChatCompletions_FlattensNamespaceTools`                              | covered | `openai-responses-chat-request-parity.test.ts`  |
| `TestConvertOpenAIResponsesRequestToOpenAIChatCompletions_QualifiesNamespaceFunctionCallHistory`               | covered | `openai-responses-chat-request-parity.test.ts`  |
| `TestConvertOpenAIResponsesRequestToOpenAIChatCompletions_FlattensNamespaceCustomTools`                        | covered | Responses extended-tools tests                  |
| `TestConvertOpenAIResponsesRequestToOpenAIChatCompletions_PreservesStructuredToolChoice`                       | covered | `openai-responses-chat-request-parity.test.ts`  |
| `TestConvertOpenAIResponsesRequestToOpenAIChatCompletions_OmitsToolSettingsWithoutTools`                       | covered | `openai-responses-chat-request-parity.test.ts`  |
| `TestConvertOpenAIResponsesRequestToOpenAIChatCompletions_PreservesParallelToolCallsWithTools`                 | covered | `openai-responses-chat-request-parity.test.ts`  |
| `TestConvertOpenAIResponsesRequestToOpenAIChatCompletions_PreservesJSONSchemaTextFormat`                       | covered | `openai-responses-chat-request-parity.test.ts`  |
| `TestConvertOpenAIResponsesRequestToOpenAIChatCompletions_PreservesJSONObjectTextFormat`                       | covered | Responses request-option tests                  |
| `TestConvertOpenAIResponsesRequestToOpenAIChatCompletions_OmitsResponseFormatWithoutTextFormat`                | covered | Responses request-option tests                  |
| `TestConvertOpenAIResponsesRequestToOpenAIChatCompletions_NormalizesInputImageDetail`                          | covered | `openai-responses-chat-request-parity.test.ts`  |
| `TestConvertOpenAIChatCompletionsResponseToOpenAIResponses_ResponseCompletedWaitsForDone`                      | covered | `openai-responses-chat-response-parity.test.ts` |
| `TestConvertOpenAIChatCompletionsResponseToOpenAIResponses_MultipleToolCallsRemainSeparate`                    | covered | `openai-responses-chat-response-parity.test.ts` |
| `TestConvertOpenAIChatCompletionsResponseToOpenAIResponses_MultiChoiceToolCallsUseDistinctOutputIndexes`       | covered | `openai-responses-chat-response-parity.test.ts` |
| `TestConvertOpenAIChatCompletionsResponseToOpenAIResponses_MixedMessageAndToolUseDistinctOutputIndexes`        | covered | `openai-responses-chat-response-parity.test.ts` |
| `TestConvertOpenAIChatCompletionsResponseToOpenAIResponses_CompletedOmitsTopLevelOutputText`                   | covered | `openai-responses-chat-response-parity.test.ts` |
| `TestConvertOpenAIChatCompletionsResponseToOpenAIResponses_ToolCallCompletedOmitsTopLevelOutputText`           | covered | `openai-responses-chat-response-parity.test.ts` |
| `TestConvertOpenAIChatCompletionsResponseToOpenAIResponses_FunctionCallDoneAndCompletedOutputStayAscending`    | covered | `openai-responses-chat-response-parity.test.ts` |
| `TestConvertOpenAIChatCompletionsResponseToOpenAIResponsesNonStream_OmitsTopLevelOutputText`                   | covered | `openai-responses-chat-response-parity.test.ts` |
| `TestConvertOpenAIChatCompletionsResponseToOpenAIResponses_RestoresNamespaceFunctionCall`                      | covered | response parity plus restoration testkit        |
| `TestConvertOpenAIChatCompletionsResponseToOpenAIResponsesNonStream_RestoresNamespaceFunctionCall`             | covered | response parity plus restoration testkit        |
| `TestConvertOpenAIChatCompletionsResponseToOpenAIResponses_CustomToolNameArrivesLate`                          | covered | response parity plus restoration testkit        |
| `TestConvertOpenAIChatCompletionsResponseToOpenAIResponses_CustomToolNameAndIDAreMissing`                      | covered | response parity plus restoration testkit        |
| `TestConvertOpenAIChatCompletionsResponseToOpenAIResponses_ToolCallIDMayArriveLateOrBeMissing`                 | covered | `openai-responses-chat-response-parity.test.ts` |
| `TestConvertOpenAIChatCompletionsResponseToOpenAIResponses_RestoresAdditionalNamespaceFunctionCall`            | covered | response parity plus restoration testkit        |
| `TestConvertOpenAIChatCompletionsResponseToOpenAIResponsesNonStream_RestoresAdditionalNamespaceFunctionCall`   | covered | response parity plus restoration testkit        |
| `TestConvertOpenAIChatCompletionsResponseToOpenAIResponses_RestoresAdditionalNamespaceCustomToolCall`          | covered | response parity plus restoration testkit        |
| `TestConvertOpenAIChatCompletionsResponseToOpenAIResponsesNonStream_RestoresAdditionalNamespaceCustomToolCall` | covered | response parity plus restoration testkit        |

## Shared translator behavior

Source directory: `internal/translator/common`.

| Upstream test                                                       | Status  | Local behavior evidence                                                                                                    |
| ------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `TestJoinRawArray`                                                  | N/A     | Go raw-byte array assembly only; Recompose translates typed values and has no raw-array mutation seam                      |
| `TestNewRawArrayItems`                                              | N/A     | Go slice capacity/allocation behavior excluded by the implementation-detail boundary                                       |
| `TestSetRawArrayItems`                                              | N/A     | Go raw-byte path replacement only; typed request encoders prove emitted arrays directly                                    |
| `TestAttachCacheControl_CopiesObject`                               | covered | `claude-chat-cache-parity.test.ts` preserves `type` and `ttl` through the Chat-to-Claude crossing                          |
| `TestAttachCacheControl_IgnoresMissing`                             | covered | `chat-completions-cache.test.ts` proves plain content emits no cache breakpoint                                            |
| `TestAttachMessageCacheControl_PromotesStringContent`               | covered | `claude-chat-cache-parity.test.ts` promotes string content and lands message cache control on its text block               |
| `TestAttachMessageCacheControl_SkipsWhenLastPartHasCacheControl`    | covered | `claude-chat-cache-parity.test.ts` proves a part-level control wins over message-level `ttl`                               |
| `TestClaudeMessageAccumulatorGroupsAndOrdersAssistantParts`         | covered | `claude-responses-history-parity.test.ts` orders thinking, text, then tool uses in one assistant turn                      |
| `TestClaudeMessageAccumulatorPreservesUserOrderAndRoleBoundaries`   | covered | `claude-responses-history-parity.test.ts` groups results in user order and keeps role changes separate                     |
| `TestClaudeMessageAccumulatorSkipsEmptyMessagesWithoutBreakingTurn` | covered | `claude-responses-history-parity.test.ts` drops an empty user turn and merges adjacent assistant content                   |
| `TestClaudeMessageAccumulatorFlushPreservesExplicitBoundary`        | covered | `gemini-claude-request-parity.test.ts` keeps explicit mid-conversation system reminders as separate user turns             |
| `TestClaudeMessageAccumulatorPreservesBlockCacheControl`            | covered | `claude-responses-history-parity.test.ts` preserves only the cached source block while merging consecutive user messages   |
| `TestNormalizeOpenAIFileData`                                       | covered | `openai-file-data.test.ts` ports all accepted and rejected data-URL, MIME, extension, and raw-base64 cases                 |
| `TestRequestModelNamePrefersOriginalRequest`                        | covered | `gateway-proxy-codex-responses-parity.test.ts` proves original virtual-model attribution overrides the translated model    |
| `TestRequestModelNameSupportsWrappedRequest`                        | N/A     | Recompose resolves the virtual model before constructing provider wrappers, so wrapped provider bodies never drive routing |

## Gemini same-dialect request normalization

Source directory: `internal/translator/gemini/gemini`.

| Upstream test                                                   | Status  | Local behavior evidence                                    |
| --------------------------------------------------------------- | ------- | ---------------------------------------------------------- |
| `TestBackfillEmptyFunctionResponseNames_Single`                 | covered | `gemini-native-function-response-name-parity.test.ts`      |
| `TestBackfillEmptyFunctionResponseNames_Parallel`               | covered | `gemini-native-function-response-name-parity.test.ts`      |
| `TestBackfillEmptyFunctionResponseNames_PreservesExisting`      | covered | `gemini-native-function-response-name-parity.test.ts`      |
| `TestConvertGeminiRequestToGemini_BackfillsEmptyName`           | covered | native bridge integration in the same focused parity suite |
| `TestBackfillEmptyFunctionResponseNames_MoreResponsesThanCalls` | covered | `gemini-native-function-response-name-parity.test.ts`      |
| `TestBackfillEmptyFunctionResponseNames_MultipleGroups`         | covered | `gemini-native-function-response-name-parity.test.ts`      |

## Current audit frontier

The exact 767-row translator completion reconciliation is published in
`docs/cliproxyapi-parity/translator-completion.md`. Its seven source-family supplements under the
same directory provide every row not already present in the slice tables below: 752 covered and 15
architecture-specific N/A rows, with zero gaps.

All 136 Interactions translator tests are classified. Another 81 Claude↔OpenAI and 7
Antigravity↔Responses translator tests are classified. Four same-dialect OpenAI Chat tests are
classified. Eight OpenAI↔Gemini, 10 Gemini↔Claude, 13 Claude↔Gemini, 13 Codex↔Gemini, 52 Codex↔Claude, 49 Codex↔Chat, 16 Codex↔Responses, 85 Gemini↔Responses, 21 Gemini↔Chat, 21 Antigravity↔Chat, 28 OpenAI↔Claude, 30 Antigravity↔Gemini, 136 Antigravity↔Claude, 36 Responses↔Chat, 15 shared translator tests, and six same-dialect Gemini tests are classified. The remaining 0 translator tests are unclassified. Non-translator engine families still require row-level classification and implementation.

Every discovered behavior gap must be implemented before its row changes to `covered`. Every N/A
row must state the architectural reason, as the allocation-only row above does.
