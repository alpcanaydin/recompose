<!-- vale off -->

# Internal client parity audit

Scope: all 82 upstream `Test*` functions under `internal/client`, compared with Recompose provider transports, model-list handling, Codex Responses WebSocket support, SSE/JSON stream codecs, compression, request/response rewriting, headers, retries, and errors. Plugin clients, Home selection, interactive CLI-only model endpoints, and Codex Live WebRTC/media clients are explicitly excluded.

## Verification

- Upstream: `go test ./internal/client/...` passed for all five packages.
- Recompose focused suite: 105/105 passed across Codex multi-agent parity, Responses WebSocket, provider transport, Claude compression, Responses streaming, model-list, and gateway-discovery tests.
- Accounting: 82/82 rows exactly once.

## Claude CLI model-response client

These tests build the Claude CLI-facing `/models` response and its reversible cross-provider ID cloak. Recompose exposes gateway virtual models through its own OpenAI-compatible discovery route and does not implement this CLI-only Claude client endpoint.

|   # | Upstream test                           | Status | Evidence / rationale                                                                                                          |
| --: | --------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
|   1 | `TestBuildResponse`                     | N/A    | Claude CLI-only model-response shaping, filtering, sorting, pagination metadata, and ID cloaking are not a Recompose surface. |
|   2 | `TestBuildResponseWithCloakingDisabled` | N/A    | No Claude CLI model endpoint or cloak toggle exists.                                                                          |
|   3 | `TestBuildResponseEmpty`                | N/A    | Same excluded endpoint.                                                                                                       |
|   4 | `TestEnsureClaudeModelIDPrefix`         | N/A    | Recompose preserves configured/provider model IDs rather than encoding them for Claude CLI discovery.                         |
|   5 | `TestResolveClaudeModelIDPrefix`        | N/A    | Same reversible CLI-only ID cloak.                                                                                            |

## Codex Live handler, Home selection, and sideband

Recompose supports Codex Responses HTTP/SSE and Responses WebSocket, not Codex Live `/v1/realtime/calls`, WebRTC SDP/media relays, Home selection, or its sideband protocol. The local `codex-websocket*` tests validate a different protocol and are not used as false evidence for this family.

|   # | Upstream test                                              | Status | Evidence / rationale                                                                                    |
| --: | ---------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
|   6 | `TestHandlerRewritesLiveCallAndSchedulesOAuth`             | N/A    | Codex Live/WebRTC and Home OAuth scheduling are absent.                                                 |
|   7 | `TestMediaCredentialNameUsesSafeIdentity`                  | N/A    | No Live media credential/session naming.                                                                |
|   8 | `TestProxyURLForAuthPrefersCredentialOverride`             | N/A    | Live auth proxy selection is absent; subscription transport policy is covered in the auth audit.        |
|   9 | `TestHandlerRelaysWebRTCMediaSDP`                          | N/A    | No WebRTC media relay.                                                                                  |
|  10 | `TestHandlerClosesUnretainedMediaSession`                  | N/A    | No Live media-session lifecycle.                                                                        |
|  11 | `TestHandlerReleasesHomeSelectionWhenMediaSetupFails`      | N/A    | Home selection is excluded.                                                                             |
|  12 | `TestHandlerClosesMediaWhenResponseWriteFails`             | N/A    | No Live media response writer.                                                                          |
|  13 | `TestHandlerRefreshesUnauthorizedHomeSelectionOnce`        | N/A    | Home selection/refresh is excluded.                                                                     |
|  14 | `TestHandlerUsesLiveModelForHomeDispatch`                  | N/A    | No Home Live dispatch.                                                                                  |
|  15 | `TestHomeLiveSessionExpiryReleasesSelection`               | N/A    | No Home Live session store.                                                                             |
|  16 | `TestHandleSidebandPinsAuthAndRelaysBidirectionally`       | N/A    | Codex Live sideband is not the Responses WebSocket protocol Recompose implements.                       |
|  17 | `TestHandleSidebandRefreshesUnauthorizedHomeHandshakeOnce` | N/A    | No Home sideband handshake.                                                                             |
|  18 | `TestPrepareCallRequestRewritesMultipart`                  | N/A    | No Live multipart SDP call request.                                                                     |
|  19 | `TestPrepareCallRequestPreservesRawSDPWhenRelayDisabled`   | N/A    | No Live relay toggle/raw SDP path.                                                                      |
|  20 | `TestMediaRelayWrapsRawSDPForCodexBackend`                 | N/A    | No WebRTC SDP wrapper.                                                                                  |
|  21 | `TestHandlerUpdatesMediaRelayConfig`                       | N/A    | No runtime Live media configuration.                                                                    |
|  22 | `TestPrepareCallRequestRejectsInvalidMultipart`            | N/A    | No Live multipart parser.                                                                               |
|  23 | `TestHeadersForLoggingRedactsAttestation`                  | N/A    | Header logging belongs to the absent Live handler; Recompose does not log subscription request headers. |
|  24 | `TestSessionStoreClaimsAndExpiresSessions`                 | N/A    | No Live session store.                                                                                  |
|  25 | `TestSessionStoreCloseAllReleasesMediaAndResources`        | N/A    | No Live media resource store.                                                                           |
|  26 | `TestSidebandURLShapes`                                    | N/A    | No Live sideband URLs.                                                                                  |

## Codex Live media relay

|   # | Upstream test                                          | Status | Evidence / rationale                             |
| --: | ------------------------------------------------------ | ------ | ------------------------------------------------ |
|  27 | `TestPionMediaRelaySelectsRemoteProxyMode`             | N/A    | Pion/WebRTC media client is absent.              |
|  28 | `TestMediaForwardingStartedLogRedactsProxyCredentials` | N/A    | No media-forwarding logger.                      |
|  29 | `TestPionMediaRelayBridgesAudioAndDataChannel`         | N/A    | No audio/data-channel bridge.                    |
|  30 | `TestIsPublicRemoteIP`                                 | N/A    | Live ICE/media address classification is absent. |

## Codex Live TCP candidate proxy

|   # | Upstream test                                                       | Status | Evidence / rationale             |
| --: | ------------------------------------------------------------------- | ------ | -------------------------------- |
|  31 | `TestPrepareProxiedUpstreamAnswerRejectsUnsafeTargets`              | N/A    | No Live ICE/TCP candidate proxy. |
|  32 | `TestPrepareProxiedUpstreamAnswerLimitsCandidateCount`              | N/A    | Same.                            |
|  33 | `TestReadValidatedICEBindingFrame`                                  | N/A    | No ICE binding-frame parser.     |
|  34 | `TestTCPCandidateTunnelAuthenticatesBeforeFixedTargetDial`          | N/A    | No TCP candidate tunnel.         |
|  35 | `TestTCPCandidateTunnelCloseCancelsProxyDial`                       | N/A    | Same.                            |
|  36 | `TestTCPCandidateTunnelProxyFailureDoesNotFallBack`                 | N/A    | Same.                            |
|  37 | `TestTCPCandidateTunnelWriteFailureDoesNotLogForwardingStart`       | N/A    | Same.                            |
|  38 | `TestTCPCandidateTunnelRejectsUnauthenticatedConnectionWithoutDial` | N/A    | Same.                            |
|  39 | `TestPionActiveTCPCandidatePassesTunnelAuthentication`              | N/A    | No Pion active TCP candidate.    |
|  40 | `TestBundledICECredentialsRejectsMixedCredentials`                  | N/A    | No bundled ICE credentials.      |
|  41 | `TestPrepareProxiedUpstreamAnswerRestrictsAndRewritesCandidates`    | N/A    | No SDP candidate rewriting.      |

## Codex CLI model-response client

These tests synthesize Codex CLI model metadata from registry templates. Recompose lists live provider/gateway model IDs and does not emulate Codex CLI's template registry, revision cache, search-tool metadata, or display metadata endpoint.

|   # | Upstream test                                                                  | Status | Evidence / rationale                                              |
| --: | ------------------------------------------------------------------------------ | ------ | ----------------------------------------------------------------- |
|  42 | `TestCodexClientModelsResponse_InputModalitiesFromRegistry`                    | N/A    | Codex CLI-only template metadata response.                        |
|  43 | `TestCodexClientModelsResponse_AppliesDisplayNameToTemplateModel`              | N/A    | Same.                                                             |
|  44 | `TestCodexClientModelsResponse_RewritesTemplateMultiAgentVersionWhenEnabled`   | N/A    | Same; request multi-agent rewriting is assessed separately below. |
|  45 | `TestCodexClientModelsResponse_DisablesSearchToolForSynthesizedModels`         | N/A    | No Codex template synthesis/search-tool metadata endpoint.        |
|  46 | `TestCodexClientModelsResponse_RequiresTemplateAndCodexProvidersForSearchTool` | N/A    | Same.                                                             |
|  47 | `TestCodexClientModelsResponse_PreservesUltraReasoningEffort`                  | N/A    | Same.                                                             |
|  48 | `TestLoadCodexClientModelTemplatesRefreshesOnRevision`                         | N/A    | No Codex CLI template/revision cache.                             |
|  49 | `TestApplyCodexClientModelMetadataPreservesMultiAgentVersionWhenDisabled`      | N/A    | No Codex CLI model metadata builder.                              |
|  50 | `TestCodexClientModelsResponseAppliesMaxContextLengthOverride`                 | N/A    | Same.                                                             |

## Codex multi-agent v2 request/response optimization

Recompose's `codex-multi-agent.ts` rewrites collaboration namespaces/tools and agent messages, while `gateway-codex-spawn-agent-parity.test.ts` proves execute, SSE stream, and compact paths plus response namespace restoration. It intentionally lacks several upstream config/client/source-selection branches.

|   # | Upstream test                                                                          | Status  | Evidence / concrete gap                                                                                                    |
| --: | -------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
|  51 | `TestDecodeCodexHomeAvailableModels`                                                   | N/A     | Decoding Home's available-model source is excluded with Home clients.                                                      |
|  52 | `TestRewriteCodexSpawnAgentDescriptionNormalizesModelList`                             | Covered | Gateway parity test proves the description's model section is replaced with the resolved target model.                     |
|  53 | `TestIsCodexMultiAgentClient`                                                          | N/A     | Recompose applies gateway policy independent of CLI user-agent detection.                                                  |
|  54 | `TestRewriteCodexSpawnAgentDescriptionTopLevelWithoutMarker`                           | Covered | Exact parity test proves markerless top-level descriptions receive the normalized model section.                           |
|  55 | `TestCodexSpawnAgentToolPathsIgnoreInvalidContainers`                                  | Covered | `optimizedTools`, `optimizedTool`, and namespace guards leave non-array/non-object containers untouched.                   |
|  56 | `TestOptimizeCodexMultiAgentV2RequestSkipsNamespaceConflict`                           | Covered | Exact parity test preserves `collaboration` when `collaboration-optimize` already exists while still removing encryption.  |
|  57 | `TestOptimizeCodexCollaborationNamespaceWithoutModels`                                 | Covered | Exact parity test prevents namespace renaming when the available-model set is empty.                                       |
|  58 | `TestRewriteCodexSpawnAgentDescriptionWithoutModelsStillRemovesEncrypted`              | Covered | Encryption removal is independent of description/model rewriting in `optimizedFunction`.                                   |
|  59 | `TestRewriteCodexSpawnAgentDescriptionLeavesPayloadWithoutToolUnchanged`               | Covered | Non-array/missing tools pass through unchanged.                                                                            |
|  60 | `TestRewriteCodexSpawnAgentDescriptionEnabledOptimizesTool`                            | Covered | Gateway parity test proves namespace rename, model description rewrite, and encrypted-field removal.                       |
|  61 | `TestPrepareCodexMultiAgentV2ToolsOnlyPreparesToolDefinitions`                         | Covered | `additional_tools` and top-level tool definitions are prepared without rewriting unrelated input items.                    |
|  62 | `TestOptimizeCodexMultiAgentV2RequestSkipsPreparedToolRefresh`                         | Covered | Already optimized namespaces are not matched as `collaboration`, so they are not refreshed.                                |
|  63 | `TestOptimizeCodexMultiAgentV2RequestNormalizesAgentMessageContentOnly`                | Covered | Gateway parity test converts encrypted agent-message parts to input text while preserving the item envelope.               |
|  64 | `TestRestoreCodexMultiAgentV2Response`                                                 | Covered | Execute, SSE, and compact answers restore `collaboration-optimize` to `collaboration`.                                     |
|  65 | `TestRewriteCodexMultiAgentV2InputRewritesAgentMessage`                                | Covered | Exact local parity body assertion proves encrypted agent content becomes readable input text.                              |
|  66 | `TestRewriteCodexMultiAgentV2InputConditions`                                          | Covered | Local code limits input rewriting to `agent_message` content arrays and `additional_tools`.                                |
|  67 | `TestTranslateRequestWithCodexMultiAgentV2Conditions`                                  | Covered | Gateway parity test exercises execute, streaming, and compact translation boundaries.                                      |
|  68 | `TestRewriteCodexSpawnAgentDescriptionDisabledLeavesPayloadUnchanged`                  | Covered | Exact parity test proves the explicit disabled policy returns the original payload.                                        |
|  69 | `TestRewriteCodexSpawnAgentDescriptionIgnoresOtherUserAgent`                           | Covered | Exact parity test gates optimization to Codex Desktop, TUI, and `codex_cli_rs` clients.                                    |
|  70 | `TestReplaceCodexSpawnAgentModelsNormalizesSectionsAndPreservesInstructions`           | Covered | Exact parity test removes duplicate/stale model sections and preserves surrounding instructions.                           |
|  71 | `TestCodexClientUserAgentPrefersGinRequest`                                            | N/A     | Gin/CLI client user-agent selection is not a Recompose boundary.                                                           |
|  72 | `TestCodexCollaborationMessageToolPathsFindsAllThreeTools`                             | Covered | Local `MESSAGE_TOOLS` contains `spawn_agent`, `send_message`, and `followup_task`.                                         |
|  73 | `TestCodexCollaborationMessageToolPathsAdditionalTools`                                | Covered | `optimizedInputItem` traverses `additional_tools`; gateway parity exercises that carrier.                                  |
|  74 | `TestCodexSpawnAgentModelsFromSourcesIncludesModelMetadata`                            | Covered | Exact parity test formats dynamic descriptions, reasoning efforts/default, and service tiers from supplied model metadata. |
|  75 | `TestRemoveCodexCollaborationMessageEncryptionAllTools`                                | Covered | The three collaboration message tools all pass through `withoutEncryptedMessage`.                                          |
|  76 | `TestRemoveCodexCollaborationMessageEncryptionPreservesUnrelatedEncryptedFields`       | Covered | Local removal destructures only `properties.message.encrypted`.                                                            |
|  77 | `TestOptimizeCodexMultiAgentV2RequestRemovesEncryptionWithoutSpawnAgent`               | Covered | `send_message` and `followup_task` are cleaned even when namespace renaming is not triggered.                              |
|  78 | `TestOptimizeCodexMultiAgentV2RequestRemovesEncryptionInAdditionalTools`               | Covered | Additional-tools traversal applies the same message schema cleanup.                                                        |
|  79 | `TestOptimizeCodexMultiAgentV2RequestRemovesEncryptionFromAllThreeToolsWithSpawnAgent` | Covered | Gateway parity proves spawn-agent optimization; the shared tool set covers all three names.                                |
|  80 | `TestRemoveCodexCollaborationMessageEncryptionNoOpWithoutEncrypted`                    | Covered | Removing an absent `encrypted` property preserves the message schema semantically.                                         |

## GrokShell CLI model-response client

|   # | Upstream test              | Status | Evidence / rationale                                                               |
| --: | -------------------------- | ------ | ---------------------------------------------------------------------------------- |
|  81 | `TestIsGrokShellUserAgent` | N/A    | GrokShell CLI user-agent detection is not a Recompose client surface.              |
|  82 | `TestBuildResponse`        | N/A    | Recompose does not implement the GrokShell-specific client model-response builder. |

## Summary

- Covered: 27
- Gap: 0
- N/A: 55

## Grouped implementation seams

All in-scope Codex multi-agent seams are covered. Codex Live/WebRTC/media/TCP-sideband support, Home selection, Claude/Codex/Grok CLI-specific model-response endpoints, and plugin clients remain explicitly outside scope.

Codex Live/WebRTC/media/TCP-sideband support, Home selection, Claude/Codex/Grok CLI-specific model-response endpoints, and plugin clients remain explicitly outside scope.
