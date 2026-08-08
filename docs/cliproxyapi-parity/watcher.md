<!-- vale off -->

# Final watcher parity reconciliation

Scope: all 167 upstream `Test*` functions across watcher core (61), synthesizer (51), and diff (55), reconciled against the current Recompose worktree after gateway lifecycle, accounts watching, account-change IPC, and provider model-policy implementation.

Every row is either **Covered** by concrete local behavior or **N/A** because the upstream concept is not part of Recompose's architecture or the explicitly excluded plugin/router/weight scope. No gaps remain.

## Evidence key

- **C1 — gateway watcher lifecycle:** `gateway-config-watcher.test.ts` and `gateway-config-watcher-lifecycle.test.ts` cover deterministic semantic hashes, unchanged suppression, add/remove, debounce, immediate refresh cancellation, path normalization, read errors, watcher error/close, timer cleanup, and abort cancellation.
- **C2 — account change propagation:** `accounts-file-watcher-parity.test.ts`, `accounts-file-watcher-model-policy.test.ts`, `accounts-changed.test.ts`, `ipc-events.test.ts`, and production `accounts:changed` wiring cover semantic account changes, normalized paths, empty/missing stability, model/account cache invalidation, and external edits.
- **C3 — provider model policy:** `model-policy.test.ts`, `model-policy-diff-parity.test.ts`, and `provider-models-policy.test.ts` cover normalized provider identifiers, normalized/deduplicated exclusions, stable hashes, add/update/removal diffs, alias display-name sensitivity, and case-insensitive live-list filtering.
- **C4 — strict storage/model contracts:** account, gateway, JSON-store, provider-origin, provider-model IPC, and engine model-list suites cover absent/corrupt storage, provider support, secret separation, typed listed-empty results, and invalid Gemini OAuth refusal.
- **C5 — gateway model snapshot:** `gateway-config-hash.ts` plus watcher/schema/model-alias tests cover deterministic full-config hashing, ordered model routing, duplicates, model/display changes, and unchanged suppression.
- **N1 — runtime-auth machinery absent:** Recompose resolves versioned account rows and vault/subscription custody per request; it has no mutable runtime auth objects, auth queue, persister, or temporal auth normalization.
- **N2 — monolithic server config absent:** Recompose has separated versioned documents and effects, not one primary server config, mirrored auth directory, remote-management config, or human-readable field-diff logger.
- **N3 — loose auth/config synthesis absent:** Recompose does not scan/import arbitrary auth JSON files or synthesize config-file API-key clients; accounts are explicit strict registry rows with secrets in the vault.
- **N4 — plugin behavior excluded:** plugin multi-auth parsing, virtual auths, precedence, and plugin-owned mutations are outside scope.
- **N5 — router/weight/compat routing excluded:** weights, priorities, force mapping, fork routing, prompt-cache compatibility switches, and custom compatibility-provider identity are outside scope.
- **N6 — ID-only model contract:** Recompose intentionally transports model IDs, not image/modalities/thinking/is-compat capability records or provider-specific configured-model sub-hashes.
- **N7 — unsupported credential transport metadata:** per-key prefix, proxy, arbitrary headers, cooling/retry flags, notes, and custom origins are not account fields.
- **N8 — opaque identity design:** accounts and vault entries use random opaque UUID identities, not deterministic secret/file-derived hashes or collision suffixes.

## Watcher core — 61 tests

|   # | Upstream test                                                  | Status  | Evidence                                                                          |
| --: | -------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------- |
|   1 | `TestApplyAuthExcludedModelsMeta_APIKey`                       | N/A     | N1; provider exclusions live in account model policy, not runtime-auth metadata.  |
|   2 | `TestApplyAuthExcludedModelsMeta_OAuthProvider`                | N/A     | N1; no mutable OAuth auth object.                                                 |
|   3 | `TestBuildAPIKeyClientsCounts`                                 | N/A     | N3.                                                                               |
|   4 | `TestNormalizeAuthStripsTemporalFields`                        | N/A     | N1.                                                                               |
|   5 | `TestMatchProvider`                                            | N/A     | N1; provider resolution is account/custody based.                                 |
|   6 | `TestSnapshotCoreAuths_ConfigAndAuthFiles`                     | N/A     | N3.                                                                               |
|   7 | `TestReloadConfigIfChanged_TriggersOnChangeAndSkipsUnchanged`  | Covered | C1 semantic refresh.                                                              |
|   8 | `TestStartAndStopSuccess`                                      | Covered | C1 start/close lifecycle.                                                         |
|   9 | `TestStartFailsWhenConfigMissing`                              | N/A     | N2; no required primary config file.                                              |
|  10 | `TestDispatchRuntimeAuthUpdateEnqueuesAndUpdatesState`         | N/A     | N1.                                                                               |
|  11 | `TestAddOrUpdateClientSkipsUnchanged`                          | Covered | C1 unchanged suppression.                                                         |
|  12 | `TestAddOrUpdateClientTriggersReloadAndHash`                   | Covered | C1 changed hash/upsert.                                                           |
|  13 | `TestRemoveClientRemovesHash`                                  | Covered | C1 known removal then silence.                                                    |
|  14 | `TestAuthFileClientChangesNotifyUsageSubscribersToRefresh`     | Covered | C2 account-change push invalidates accounts and provider-model queries.           |
|  15 | `TestAuthFileEventsDoNotInvokeSnapshotCoreAuths`               | N/A     | N1.                                                                               |
|  16 | `TestAuthSliceToMap`                                           | N/A     | N1.                                                                               |
|  17 | `TestTriggerServerUpdateCancelsPendingTimerOnImmediate`        | Covered | C1 direct parity test.                                                            |
|  18 | `TestShouldDebounceRemove`                                     | Covered | C1 per-path debounce.                                                             |
|  19 | `TestAuthFileUnchangedUsesHash`                                | Covered | C1/C2 semantic hashes.                                                            |
|  20 | `TestAuthFileUnchangedEmptyAndMissing`                         | Covered | C2 direct parity test.                                                            |
|  21 | `TestReloadClientsCachesAuthHashes`                            | Covered | C1/C2 `prime()` caches semantic state.                                            |
|  22 | `TestReloadClientsLogsConfigDiffs`                             | N/A     | N2.                                                                               |
|  23 | `TestReloadClientsHandlesNilConfig`                            | N/A     | N2.                                                                               |
|  24 | `TestReloadClientsNotifiesUsageSubscribersToRefresh`           | Covered | C2 typed event/cache invalidation parity test.                                    |
|  25 | `TestReloadClientsFiltersProvidersWithNilCurrentAuths`         | N/A     | N1.                                                                               |
|  26 | `TestSetAuthUpdateQueueNilResetsDispatch`                      | N/A     | N1.                                                                               |
|  27 | `TestPersistAsyncEarlyReturns`                                 | N/A     | N1; stores persist directly.                                                      |
|  28 | `TestPersistAsyncErrorPaths`                                   | N/A     | N1.                                                                               |
|  29 | `TestStopConfigReloadTimerSafeWhenNil`                         | Covered | C1 idempotent close/timer cleanup.                                                |
|  30 | `TestHandleEventRemovesAuthFile`                               | Covered | C1 known file removal.                                                            |
|  31 | `TestDispatchAuthUpdatesFlushesQueue`                          | N/A     | N1.                                                                               |
|  32 | `TestDispatchLoopExitsOnContextDoneWhileSending`               | N/A     | N1.                                                                               |
|  33 | `TestProcessEventsHandlesEventErrorAndChannelClose`            | Covered | C1 direct error/terminal-close parity test.                                       |
|  34 | `TestProcessEventsReturnsWhenErrorsChannelClosed`              | N/A     | Node `fs.watch` has no separate errors channel.                                   |
|  35 | `TestHandleEventIgnoresUnrelatedFiles`                         | Covered | C1 rejects unrelated paths/extensions.                                            |
|  36 | `TestHandleEventConfigChangeSchedulesReload`                   | Covered | C1 debounced JSON event.                                                          |
|  37 | `TestHandleEventAuthWriteTriggersUpdate`                       | Covered | C2 direct filesystem-event parity test.                                           |
|  38 | `TestHandleEventRemoveDebounceSkips`                           | Covered | C1 repeated remove coalescing.                                                    |
|  39 | `TestHandleEventAtomicReplaceUnchangedSkips`                   | Covered | C1/C2 semantic unchanged suppression.                                             |
|  40 | `TestHandleEventAtomicReplaceChangedTriggersUpdate`            | Covered | C1/C2 changed event refresh.                                                      |
|  41 | `TestHandleEventRemoveUnknownFileIgnored`                      | Covered | C1 unknown removal is silent.                                                     |
|  42 | `TestHandleEventRemoveKnownFileDeletes`                        | Covered | C1 known removal.                                                                 |
|  43 | `TestNormalizeAuthPathAndDebounceCleanup`                      | Covered | C1/C2 normalized paths and timer cleanup direct tests.                            |
|  44 | `TestRefreshAuthStateDispatchesRuntimeAuths`                   | N/A     | N1.                                                                               |
|  45 | `TestAddOrUpdateClientEdgeCases`                               | N/A     | N3; strict registry/quarantine replaces loose auth-file parsing.                  |
|  46 | `TestLoadFileClientsWalkError`                                 | Covered | C1 direct read-error/recovery contract.                                           |
|  47 | `TestReloadConfigIfChangedHandlesMissingAndEmpty`              | N/A     | N2; no primary config reload path.                                                |
|  48 | `TestReloadConfigUsesMirroredAuthDir`                          | N/A     | N2.                                                                               |
|  49 | `TestReloadConfigFiltersAffectedOAuthProviders`                | N/A     | N1; C3 refreshes account/model consumers without runtime-auth rescans.            |
|  50 | `TestReloadConfigTriggersCallbackForMaxRetryCredentialsChange` | N/A     | N2/N7.                                                                            |
|  51 | `TestStartFailsWhenAuthDirMissing`                             | N/A     | N3; storage owns/creates its known paths rather than requiring an auth directory. |
|  52 | `TestDispatchRuntimeAuthUpdateReturnsFalseWithoutQueue`        | N/A     | N1.                                                                               |
|  53 | `TestNormalizeAuthNil`                                         | N/A     | N1.                                                                               |
|  54 | `TestNewWatcherDetectsPersisterAndAuthDir`                     | N/A     | N1/N3.                                                                            |
|  55 | `TestPersistConfigAndAuthAsyncInvokePersister`                 | N/A     | N1.                                                                               |
|  56 | `TestScheduleConfigReloadDebounces`                            | Covered | C1 direct debounce evidence.                                                      |
|  57 | `TestPrepareAuthUpdatesLockedForceAndDelete`                   | N/A     | N1/N5.                                                                            |
|  58 | `TestAuthEqualIgnoresTemporalFields`                           | N/A     | N1.                                                                               |
|  59 | `TestDispatchLoopExitsWhenQueueNilAndContextCanceled`          | N/A     | N1.                                                                               |
|  60 | `TestReloadClientsFiltersOAuthProvidersWithoutRescan`          | N/A     | N1.                                                                               |
|  61 | `TestScheduleProcessEventsStopsOnContextDone`                  | Covered | C1 AbortSignal parity test.                                                       |

## Synthesizer — 51 tests

|   # | Upstream test                                                    | Status  | Evidence                                                                                         |
| --: | ---------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------ |
|  62 | `TestNewConfigSynthesizer`                                       | N/A     | N3.                                                                                              |
|  63 | `TestConfigSynthesizer_Synthesize_NilContext`                    | N/A     | N3.                                                                                              |
|  64 | `TestConfigSynthesizer_Synthesize_NilConfig`                     | N/A     | N3.                                                                                              |
|  65 | `TestConfigSynthesizer_GeminiKeys`                               | N/A     | N3/N7; Gemini account/origin support is C4, not config synthesis.                                |
|  66 | `TestConfigSynthesizer_InteractionsKeys`                         | N/A     | N3/N7; interactions account/list support is C4.                                                  |
|  67 | `TestConfigSynthesizer_ClaudeKeys`                               | N/A     | N3/N7.                                                                                           |
|  68 | `TestConfigSynthesizer_ClaudeKeys_SkipsEmptyAndHeaders`          | N/A     | N3/N7; blank keys are rejected by C4.                                                            |
|  69 | `TestConfigSynthesizer_CodexKeys`                                | N/A     | N3/N7.                                                                                           |
|  70 | `TestConfigSynthesizer_XAIKeys`                                  | N/A     | N3/N7; fixed xAI origin is covered by C4.                                                        |
|  71 | `TestConfigSynthesizer_CodexKeys_SkipsEmptyAndHeaders`           | N/A     | N3/N7.                                                                                           |
|  72 | `TestConfigSynthesizer_OpenAICompat`                             | N/A     | N3/N5.                                                                                           |
|  73 | `TestConfigSynthesizer_OpenAICompat_UsesNamespacedProviderKey`   | N/A     | N5.                                                                                              |
|  74 | `TestConfigSynthesizer_VertexCompat`                             | N/A     | N3/N7; fixed Vertex origin is C4.                                                                |
|  75 | `TestConfigSynthesizer_VertexCompat_SkipsEmptyAndHeaders`        | N/A     | N3/N5/N7.                                                                                        |
|  76 | `TestConfigSynthesizer_OpenAICompat_WithModelsHash`              | N/A     | N5/N6.                                                                                           |
|  77 | `TestConfigSynthesizer_OpenAICompat_FallbackWithModels`          | N/A     | N5/N6.                                                                                           |
|  78 | `TestConfigSynthesizer_VertexCompat_WithModels`                  | N/A     | N6.                                                                                              |
|  79 | `TestConfigSynthesizer_IDStability`                              | N/A     | N8.                                                                                              |
|  80 | `TestConfigSynthesizer_RejectsInvalidWeightsForAllAPIKeyTypes`   | N/A     | N5.                                                                                              |
|  81 | `TestConfigSynthesizer_OmittedWeightRemainsUnset`                | N/A     | N5.                                                                                              |
|  82 | `TestConfigSynthesizer_NormalizesNonPositiveWeightToZero`        | N/A     | N5.                                                                                              |
|  83 | `TestConfigSynthesizer_PropagatesWeightsForAllAPIKeyTypes`       | N/A     | N5.                                                                                              |
|  84 | `TestConfigSynthesizer_AllProviders`                             | N/A     | N3; provider reach itself is C4.                                                                 |
|  85 | `TestNewFileSynthesizer`                                         | N/A     | N3.                                                                                              |
|  86 | `TestFileSynthesizer_Synthesize_NilContext`                      | N/A     | N3.                                                                                              |
|  87 | `TestFileSynthesizer_Synthesize_EmptyAuthDir`                    | Covered | C4 absent registry yields current empty document.                                                |
|  88 | `TestFileSynthesizer_Synthesize_NonExistentDir`                  | Covered | C4 ENOENT yields empty registry without quarantine.                                              |
|  89 | `TestFileSynthesizer_Synthesize_ValidAuthFile`                   | N/A     | N3.                                                                                              |
|  90 | `TestFileSynthesizer_Synthesize_IgnoresGeminiProviderFile`       | Covered | C4 subscription schema refuses Gemini OAuth rows.                                                |
|  91 | `TestSynthesizeAuthFileExpandsPluginMultiAuths`                  | N/A     | N4.                                                                                              |
|  92 | `TestSynthesizeAuthFileSkipsInvalidPluginAuthWeight`             | N/A     | N4/N5.                                                                                           |
|  93 | `TestSynthesizeAuthFileAppliesSourceDisabledToPluginMultiAuths`  | N/A     | N4.                                                                                              |
|  94 | `TestSynthesizeAuthFilePluginHandledEmptySuppressesBuiltin`      | N/A     | N4.                                                                                              |
|  95 | `TestFileSynthesizer_Synthesize_SkipsInvalidFiles`               | N/A     | N3; strict single-document quarantine is the intentional contract.                               |
|  96 | `TestFileSynthesizer_Synthesize_SkipsDirectories`                | N/A     | N3.                                                                                              |
|  97 | `TestFileSynthesizer_Synthesize_RelativeID`                      | N/A     | N8.                                                                                              |
|  98 | `TestFileSynthesizer_Synthesize_PrefixValidation`                | N/A     | N7.                                                                                              |
|  99 | `TestFileSynthesizer_Synthesize_PriorityParsing`                 | N/A     | N5.                                                                                              |
| 100 | `TestFileSynthesizer_Synthesize_WeightParsing`                   | N/A     | N5.                                                                                              |
| 101 | `TestFileSynthesizer_Synthesize_OAuthExcludedModelsMerged`       | N/A     | N3; provider policy normalization/filtering is C3, but no per-file OAuth metadata source exists. |
| 102 | `TestFileSynthesizer_Synthesize_OAuthModelAliases`               | N/A     | N3/N5; C3 stores/diffs aliases, while fork routing is excluded.                                  |
| 103 | `TestFileSynthesizer_Synthesize_IgnoresGeminiOAuthFile`          | Covered | C4 subscription provider schema excludes Gemini.                                                 |
| 104 | `TestFileSynthesizer_Synthesize_NoteParsing`                     | N/A     | N7.                                                                                              |
| 105 | `TestNewStableIDGenerator`                                       | N/A     | N8.                                                                                              |
| 106 | `TestStableIDGenerator_Next`                                     | N/A     | N8.                                                                                              |
| 107 | `TestStableIDGenerator_Stability`                                | N/A     | N8.                                                                                              |
| 108 | `TestStableIDGenerator_CollisionHandling`                        | N/A     | N8; duplicate stored IDs are rejected by C4.                                                     |
| 109 | `TestStableIDGenerator_NilReceiver`                              | N/A     | N8.                                                                                              |
| 110 | `TestApplyAuthExcludedModelsMeta`                                | N/A     | N1; exclusion policy/hash behavior itself is C3.                                                 |
| 111 | `TestApplyAuthExcludedModelsMeta_OAuthMergeWritesCombinedModels` | N/A     | N1/N3; no runtime-auth attributes or per-file source.                                            |
| 112 | `TestAddConfigHeadersToAttrs`                                    | N/A     | N7.                                                                                              |

## Diff — 55 tests

|   # | Upstream test                                                         | Status  | Evidence                                                            |
| --: | --------------------------------------------------------------------- | ------- | ------------------------------------------------------------------- |
| 113 | `TestDiffOAuthModelAliasChanges_IncludesDisplayName`                  | Covered | C3 exact parity test.                                               |
| 114 | `TestDiffOpenAICompatibility`                                         | N/A     | N5.                                                                 |
| 115 | `TestDiffOpenAICompatibilityPromptCacheKey`                           | N/A     | N5.                                                                 |
| 116 | `TestDiffOpenAICompatibilityDuplicateNames`                           | N/A     | N5.                                                                 |
| 117 | `TestDiffOpenAICompatibilityDuplicateKeyDoesNotCollide`               | N/A     | N5.                                                                 |
| 118 | `TestDiffOpenAICompatibility_RemovedAndUnchanged`                     | N/A     | N5; generic gateway removal/unchanged is C1.                        |
| 119 | `TestOpenAICompatKeyFallbacks`                                        | N/A     | N5.                                                                 |
| 120 | `TestOpenAICompatKey_UsesName`                                        | N/A     | N5.                                                                 |
| 121 | `TestOpenAICompatKey_SignatureFallbackWhenOnlyAPIKeys`                | N/A     | N5/N8.                                                              |
| 122 | `TestOpenAICompatSignature_EmptyReturnsEmpty`                         | N/A     | N5.                                                                 |
| 123 | `TestOpenAICompatSignature_StableAndNormalized`                       | N/A     | N5.                                                                 |
| 124 | `TestCountOpenAIModelsSkipsBlanks`                                    | N/A     | N5/N6; local contracts reject blank IDs.                            |
| 125 | `TestOpenAICompatKeyUsesModelNameWhenAliasEmpty`                      | N/A     | N5.                                                                 |
| 126 | `TestModelHashesIncludeIsCompat`                                      | N/A     | N5/N6.                                                              |
| 127 | `TestBuildConfigChangeDetails`                                        | N/A     | N2.                                                                 |
| 128 | `TestBuildConfigChangeDetails_NoChanges`                              | Covered | C1/C2 unchanged semantic suppression.                               |
| 129 | `TestBuildConfigChangeDetails_CodexLiveMediaRelay`                    | N/A     | N2.                                                                 |
| 130 | `TestBuildConfigChangeDetails_GeminiVertexHeaders`                    | N/A     | N2/N7.                                                              |
| 131 | `TestBuildConfigChangeDetails_ModelPrefixes`                          | N/A     | N2/N7.                                                              |
| 132 | `TestBuildConfigChangeDetails_CodexAlphaSearch`                       | N/A     | N2/N7.                                                              |
| 133 | `TestBuildConfigChangeDetails_XAIKeys`                                | N/A     | N2/N7.                                                              |
| 134 | `TestBuildConfigChangeDetails_XAIForceMappingOnly`                    | N/A     | N5.                                                                 |
| 135 | `TestBuildConfigChangeDetails_NilSafe`                                | N/A     | N2.                                                                 |
| 136 | `TestBuildConfigChangeDetails_SecretsAndCounts`                       | N/A     | N2; C4 structurally excludes secrets instead of logging redactions. |
| 137 | `TestBuildConfigChangeDetails_RedactsEndpointURLs`                    | N/A     | N2/N7.                                                              |
| 138 | `TestBuildConfigChangeDetails_FlagsAndKeys`                           | N/A     | N2.                                                                 |
| 139 | `TestBuildConfigChangeDetails_AllBranches`                            | N/A     | N2/N5.                                                              |
| 140 | `TestFormatProxyURL`                                                  | N/A     | N2/N7.                                                              |
| 141 | `TestBuildConfigChangeDetails_RemoteManagementSecretUpdated`          | N/A     | N2.                                                                 |
| 142 | `TestBuildConfigChangeDetails_CountBranches`                          | N/A     | N2/N3.                                                              |
| 143 | `TestTrimStrings`                                                     | N/A     | N2; local schemas trim fields directly.                             |
| 144 | `TestSummarizeExcludedModels_NormalizesAndDedupes`                    | Covered | C3 exact parity test.                                               |
| 145 | `TestDiffOAuthExcludedModelChanges`                                   | Covered | C3 exact add/update/removal parity test.                            |
| 146 | `TestSummarizeOAuthExcludedModels_NormalizesKeys`                     | Covered | C3 exact parity test.                                               |
| 147 | `TestSummarizeVertexModels`                                           | N/A     | N6.                                                                 |
| 148 | `TestComputeOpenAICompatModelsHash_Deterministic`                     | Covered | C5 deterministic model snapshot.                                    |
| 149 | `TestComputeOpenAICompatModelsHash_IncludesImageFlag`                 | N/A     | N6.                                                                 |
| 150 | `TestComputeOpenAICompatModelsHashIncludesModalities`                 | N/A     | N6.                                                                 |
| 151 | `TestComputeOpenAICompatModelsHashPreservesRoutingOrderAndDuplicates` | Covered | C5 arrays preserve order and duplicates.                            |
| 152 | `TestComputeVertexCompatModelsHash_DifferentInputs`                   | Covered | C5 model target changes alter hash.                                 |
| 153 | `TestComputeVertexCompatModelsHashPreservesDuplicates`                | Covered | C5.                                                                 |
| 154 | `TestComputeClaudeModelsHash_Empty`                                   | N/A     | N6; no provider sub-hash sentinel.                                  |
| 155 | `TestComputeCodexModelsHash_Empty`                                    | N/A     | N6.                                                                 |
| 156 | `TestComputeClaudeModelsHashPreservesDuplicates`                      | Covered | C5.                                                                 |
| 157 | `TestComputeCodexModelsHashPreservesDuplicates`                       | Covered | C5.                                                                 |
| 158 | `TestComputeModelHashesIncludeDisplayName`                            | Covered | C5; C3 alias display names also affect semantic state.              |
| 159 | `TestComputeCodexModelsHashIncludesForceMapping`                      | N/A     | N5.                                                                 |
| 160 | `TestComputeOtherModelHashesIncludeForceMapping`                      | N/A     | N5.                                                                 |
| 161 | `TestComputeExcludedModelsHash_Normalizes`                            | Covered | C3 exact parity test.                                               |
| 162 | `TestComputeOpenAICompatModelsHash_Empty`                             | N/A     | N6.                                                                 |
| 163 | `TestComputeVertexCompatModelsHash_Empty`                             | N/A     | N6.                                                                 |
| 164 | `TestComputeExcludedModelsHash_Empty`                                 | Covered | C3 exact parity test.                                               |
| 165 | `TestComputeClaudeModelsHash_Deterministic`                           | Covered | C5.                                                                 |
| 166 | `TestComputeCodexModelsHash_Deterministic`                            | Covered | C5.                                                                 |
| 167 | `TestComputeModelHashesIncludeThinking`                               | N/A     | N6.                                                                 |

## Final result

- Total upstream tests: **167**
- Covered: **47**
- N/A: **120**
- Gap: **0**

The final in-scope implementation adds no plugin, router, weight, custom compatibility-provider, loose auth-import, or monolithic config-diff behavior. The only residual implementation was production account-change propagation: filesystem account/model-policy changes now emit a typed `accounts:changed` event and invalidate live account and provider-model caches.
