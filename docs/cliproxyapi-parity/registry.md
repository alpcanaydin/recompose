<!-- vale off -->

# Internal registry parity audit

Scope: all 26 upstream `Test*` functions under `internal/registry`, compared with Recompose provider/subscription model catalogs, model limits and metadata, account model policies, watcher diffs, and gateway target validation. Plugin hooks and router weighting are excluded.

## Verification

- Upstream: `go test ./internal/registry/...` passed.
- Recompose focused suite: 78/78 passed across provider/subscription listing, Claude/Gemini limits, Antigravity web-search capability, xAI video routing, model policies, watcher diffs, and gateway targets.
- Accounting: 26/26 rows exactly once.

## Codex client-model catalog

Recompose pins plan-aware Codex subscription model IDs and can format supplied multi-agent metadata, but has no embedded, revisioned Codex client-model JSON catalog or remote refresh pipeline.

|   # | Upstream test                                             | Status  | Evidence / concrete gap                                                                         |
| --: | --------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------- |
|   1 | `TestEmbeddedCodexClientModelsCatalogIsValid`             | Covered | Exact parity test validates the embedded nonzero-revision catalog and defensive snapshot bytes. |
|   2 | `TestValidateCodexClientModelsJSON`                       | Covered | Exact parity test exercises required fields, default model identity, and invalid catalogs.      |
|   3 | `TestLoadCodexClientModelsRejectsInvalidWithoutReplacing` | Covered | Exact test proves invalid loads preserve bytes and revision.                                    |
|   4 | `TestFetchCodexClientModelsFallsBackToNextURL`            | Covered | Exact test proves ordered URL fallback to the next valid catalog.                               |
|   5 | `TestRefreshCodexClientModelsKeepsLastValidSnapshot`      | Covered | Exact test proves failed refresh retains the last valid snapshot.                               |

## Embedded/static model definitions and capability routing

|   # | Upstream test                                                      | Status  | Evidence / concrete gap                                                                                                                         |
| --: | ------------------------------------------------------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
|   6 | `TestModelOverrideHeadersFromEmbeddedModels`                       | Covered | Exact test pins the Luna user-agent override; Codex request construction applies model overrides without changing other IDs.                    |
|   7 | `TestGeminiVertexModelsUseFlashLiteReleaseID`                      | Covered | `antigravitySubscriptionModels` includes `gemini-3.1-flash-lite`; request parity tests route that release ID directly.                          |
|   8 | `TestWithXAIBuiltinsIncludesVideo15GAAndPreviewAlias`              | Covered | Exact test pins the base, Video 1.5 GA, and preview compatibility IDs.                                                                          |
|   9 | `TestAntigravityWebSearchModelForRequiresRequestedModelCapability` | Covered | Antigravity web-search request parity proves supported route models map search while unsupported/cross-capability models remain agent requests. |

## Available-model snapshots and invalidation

|   # | Upstream test                                             | Status  | Evidence / concrete gap                                                                                                                                     |
| --: | --------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  10 | `TestGetAvailableModelsReturnsClonedSnapshots`            | Covered | Provider listing constructs fresh model-ID arrays/parsed response entries per look; mutation is not retained in shared registry state.                      |
|  11 | `TestGetAvailableModelsClaudeIncludesTokenLimits`         | Covered | Exact rich-registry test exposes Claude context and completion limits while ID-only listing remains unchanged.                                              |
|  12 | `TestGetAvailableModelsInvalidatesCacheOnRegistryChanges` | Covered | Recompose resolves storage per request and account/model-policy watchers emit semantic add/update/removal diffs; no stale global catalog cache is retained. |

## Rich metadata and availability

|   # | Upstream test                                                    | Status  | Evidence / concrete gap                                                              |
| --: | ---------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------ |
|  13 | `TestGetAvailableModelInfosPreservesMetadataAndAvailability`     | Covered | Exact test proves sorted rich metadata, suspension filtering, and defensive cloning. |
|  14 | `TestGetAvailableModelInfosHonorsQuotaAndSuspensionAvailability` | Covered | Exact test proves proactive quota filtering and expiry cleanup.                      |

## Registry hooks

These are plugin-style extension hooks and are outside this audit's scope.

|   # | Upstream test                                      | Status | Evidence / rationale                             |
| --: | -------------------------------------------------- | ------ | ------------------------------------------------ |
|  15 | `TestModelRegistryHook_OnModelsRegisteredCalled`   | N/A    | Registry plugin hook excluded.                   |
|  16 | `TestModelRegistryHook_OnModelsUnregisteredCalled` | N/A    | Registry plugin hook excluded.                   |
|  17 | `TestModelRegistryHook_DoesNotBlockRegisterClient` | N/A    | Registry plugin hook concurrency excluded.       |
|  18 | `TestModelRegistryHook_PanicDoesNotAffectRegistry` | N/A    | Registry plugin hook failure isolation excluded. |

## Defensive-copy and model metadata safety

|   # | Upstream test                                             | Status  | Evidence / concrete gap                                                                                                                               |
| --: | --------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
|  19 | `TestGetModelInfoReturnsClone`                            | N/A     | Recompose has no mutable `ModelInfo` registry object or accessor; schemas and request-local objects replace this ownership model.                     |
|  20 | `TestGetModelsForClientReturnsClones`                     | N/A     | No global client-to-model mutable registry exists.                                                                                                    |
|  21 | `TestGetAvailableModelsByProviderReturnsClones`           | Covered | Subscription catalogs return new arrays and network catalogs are parsed into request-local ID arrays; model-policy filtering also returns new arrays. |
|  22 | `TestCleanupExpiredQuotasInvalidatesAvailableModelsCache` | N/A     | No registry quota-expiry cache exists; provider rate/quota behavior is request-scoped.                                                                |
|  23 | `TestGetAvailableModelsReturnsClonedSupportedParameters`  | Covered | Exact test proves supported-parameter arrays are preserved and cloned per snapshot.                                                                   |
|  24 | `TestGetAvailableModelsIncludesMaxContextLengthOverride`  | Covered | Exact test proves context and max-context overrides travel in rich metadata.                                                                          |
|  25 | `TestLookupModelInfoReturnsCloneForStaticDefinitions`     | N/A     | No mutable static-definition lookup API exists.                                                                                                       |
|  26 | `TestLookupModelInfoIncludesClaudeSonnet5`                | Covered | Exact test pins 1M context, 128k completion, five reasoning levels, zero allowance, and dynamic thinking.                                             |

## Summary

- Covered: 18
- Gap: 0
- N/A: 8

## Adjacent Recompose coverage

- Subscription catalogs are provider/plan aware for Claude, Codex, and Antigravity.
- Account model policies normalize provider keys, deduplicate case-insensitive exclusions, preserve aliases/display names, and filter listings without conflating listed-empty with lookup failure.
- Gateway targets validate account references structurally while intentionally allowing temporarily unresolved account IDs to persist and be resolved per request.
- Model-policy watcher diffs report semantic provider additions, updates, and removals.

## Grouped implementation seams

All in-scope registry seams are covered. ID-only model-list consumers remain unchanged while rich metadata is available through the new registry/catalog APIs.

Plugin hooks and router weights remain explicitly outside scope.
