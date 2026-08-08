<!-- vale off -->

# Final cache parity reconciliation

Scope: all 65 upstream `internal/cache` tests, reconciled against Recompose provider replay, prompt-cache, bounded LRU, and signature-cache behavior.

## Final counts

- **Covered: 40**
- **N/A: 25**
- **Gaps: 0**

The N/A rows are distributed Home/KV CAS/expiry contracts and global signature-mode logging APIs that do not exist in the local architecture. All in-memory behavior-bearing rows now have direct local coverage.

## Row-level reconciliation

|   # | Seam               | Upstream test                                                                    | Status  | Local evidence                                                                                                                |
| --: | ------------------ | -------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
|   1 | xAI replay         | `TestXAIReasoningReplayCacheRejectsCodexEncryptedContent`                        | Covered | Direct behavioral suite: `packages/engine/src/provider/xai-replay.test.ts`                                                    |
|   2 | xAI replay         | `TestXAIReasoningReplayCacheStoresGrokEncryptedContent`                          | Covered | Direct behavioral suite: `packages/engine/src/provider/xai-replay.test.ts`                                                    |
|   3 | xAI replay         | `TestXAIReasoningReplayCacheStoresAssistantMessageWithReasoning`                 | Covered | Direct behavioral suite: `packages/engine/src/provider/xai-replay.test.ts`                                                    |
|   4 | xAI replay         | `TestXAIReasoningReplayCacheRejectsAssistantMessageWithoutReasoning`             | Covered | Direct behavioral suite: `packages/engine/src/provider/xai-replay.test.ts`                                                    |
|   5 | xAI replay         | `TestXAIReasoningReplayCacheStoresToolCallWithoutReasoning`                      | Covered | Direct behavioral suite: `packages/engine/src/provider/xai-replay.test.ts`                                                    |
|   6 | xAI replay         | `TestXAIReasoningReplayRequiredHomeExpireFailureReturnsItems`                    | N/A     | Distributed Home/KV read/write/CAS/expiry/generation contract; Recompose has no Home cache backend.                           |
|   7 | xAI replay         | `TestXAIReasoningReplayCacheStoresRefusalMessagePart`                            | Covered | Direct behavioral suite: `packages/engine/src/provider/xai-replay.test.ts`                                                    |
|   8 | Kimi replay        | `TestKimiThinkingReplayConditionalDeleteKeepsNewerContent`                       | Covered | Exact-named test: `packages/engine/src/provider/kimi-thinking-replay-state-parity.test.ts:6`                                  |
|   9 | Kimi replay        | `TestKimiThinkingReplayConditionalReplaceKeepsConcurrentContent`                 | Covered | Exact-named test: `packages/engine/src/provider/kimi-thinking-replay-state-parity.test.ts:18`                                 |
|  10 | Kimi replay        | `TestKimiThinkingReplayTombstoneFencesConcurrentMiss`                            | Covered | Exact-named test: `packages/engine/src/provider/kimi-thinking-replay-state-parity.test.ts:30`                                 |
|  11 | Kimi replay        | `TestKimiThinkingReplayHomeGenerationPreventsABADelete`                          | Covered | Exact-named test: `packages/engine/src/provider/kimi-thinking-replay-state-parity.test.ts:39`                                 |
|  12 | Kimi replay        | `TestKimiThinkingReplayTracksAggregateLocalBytes`                                | Covered | Exact-named test: `packages/engine/src/provider/kimi-thinking-replay-state-parity.test.ts:52`                                 |
|  13 | Kimi replay        | `TestKimiThinkingReplayRejectsOversizedContent`                                  | Covered | Exact-named test: `packages/engine/src/provider/kimi-thinking-replay-state-parity.test.ts:67`                                 |
|  14 | Bounded LRU        | `TestBoundedLRUEvictsLeastRecentlyUsed`                                          | Covered | Exact-named test: `packages/engine/src/provider/cache-foundation-parity.test.ts:6`                                            |
|  15 | Bounded LRU        | `TestBoundedLRUCreatesOneValuePerKeyConcurrently`                                | Covered | Exact-named test: `packages/engine/src/provider/cache-foundation-parity.test.ts:18`                                           |
|  16 | Codex replay       | `TestCodexReasoningReplayCacheRejectsInvalidItems`                               | Covered | Direct behavioral suite: `packages/engine/src/subscription/codex-replay-state-parity.test.ts and codex-replay-parity.test.ts` |
|  17 | Codex replay       | `TestCodexReasoningReplayRequiredHomeReadAndSlidingExpire`                       | N/A     | Distributed Home/KV read/write/CAS/expiry/generation contract; Recompose has no Home cache backend.                           |
|  18 | Codex replay       | `TestCodexReasoningReplayRequiredHomeFailures`                                   | N/A     | Distributed Home/KV read/write/CAS/expiry/generation contract; Recompose has no Home cache backend.                           |
|  19 | Codex replay       | `TestCodexReasoningReplayBestEffortHomeWriteFailureDoesNotUseLocalCache`         | N/A     | Distributed Home/KV read/write/CAS/expiry/generation contract; Recompose has no Home cache backend.                           |
|  20 | Codex replay       | `TestCodexReasoningReplayAppendPreservesCumulativeTurnsInHome`                   | Covered | Direct behavioral suite: `packages/engine/src/subscription/codex-replay-state-parity.test.ts and codex-replay-parity.test.ts` |
|  21 | Codex replay       | `TestCodexReasoningReplayAppendHomeCASPreservesConcurrentTurns`                  | N/A     | Distributed Home/KV read/write/CAS/expiry/generation contract; Recompose has no Home cache backend.                           |
|  22 | Codex replay       | `TestCodexReasoningReplayAppendBoundsTurnsPerEntry`                              | Covered | Direct behavioral suite: `packages/engine/src/subscription/codex-replay-state-parity.test.ts and codex-replay-parity.test.ts` |
|  23 | Codex replay       | `TestCodexReasoningReplayHomeRejectsEmptyScopeWithoutKV`                         | N/A     | Distributed Home/KV read/write/CAS/expiry/generation contract; Recompose has no Home cache backend.                           |
|  24 | Codex replay       | `TestCodexReasoningReplayCacheScopesByModelAndSession`                           | Covered | Direct behavioral suite: `packages/engine/src/subscription/codex-replay-state-parity.test.ts and codex-replay-parity.test.ts` |
|  25 | Codex replay       | `TestCodexReasoningReplayCacheBatchEvictsWhenFull`                               | Covered | Direct behavioral suite: `packages/engine/src/subscription/codex-replay-state-parity.test.ts and codex-replay-parity.test.ts` |
|  26 | Antigravity replay | `TestAntigravityReasoningReplayConditionalMutationRejectsStaleLocalSnapshot`     | Covered | Exact-named test: `packages/engine/src/subscription/antigravity-replay-state-parity.test.ts:5`                                |
|  27 | Antigravity replay | `TestAntigravityReasoningReplayNonPrefixReplaceRotatesLocalBranch`               | Covered | Exact-named test: `packages/engine/src/subscription/antigravity-replay-state-parity.test.ts:16`                               |
|  28 | Antigravity replay | `TestAntigravityReasoningReplayConditionalReplaceAcceptsDescendantLocalChain`    | Covered | Exact-named test: `packages/engine/src/subscription/antigravity-replay-state-parity.test.ts:25`                               |
|  29 | Antigravity replay | `TestAntigravityReasoningReplayDescendantMergeRejectsResetBranchABA`             | Covered | Exact-named test: `packages/engine/src/subscription/antigravity-replay-state-parity.test.ts:37`                               |
|  30 | Antigravity replay | `TestAntigravityReasoningReplayConditionalDeleteTombstoneBlocksStaleFirstWriter` | Covered | Exact-named test: `packages/engine/src/subscription/antigravity-replay-state-parity.test.ts:47`                               |
|  31 | Antigravity replay | `TestAntigravityReasoningReplayEvictedTombstoneStillBlocksStaleFirstWriter`      | Covered | Exact-named test: `packages/engine/src/subscription/antigravity-replay-state-parity.test.ts:56`                               |
|  32 | Antigravity replay | `TestAntigravityReasoningReplayUnrelatedEvictionDoesNotBlockAbsentSnapshot`      | Covered | Exact-named test: `packages/engine/src/subscription/antigravity-replay-state-parity.test.ts:67`                               |
|  33 | Antigravity replay | `TestAntigravityReasoningReplayHomeAbsentSnapshotIsFenced`                       | N/A     | Distributed Home/KV read/write/CAS/expiry/generation contract; Recompose has no Home cache backend.                           |
|  34 | Antigravity replay | `TestAntigravityReasoningReplayConditionalMutationRejectsStaleHomeSnapshot`      | N/A     | Distributed Home/KV read/write/CAS/expiry/generation contract; Recompose has no Home cache backend.                           |
|  35 | Antigravity replay | `TestAntigravityReasoningReplayNonPrefixReplaceRotatesHomeBranch`                | N/A     | Distributed Home/KV read/write/CAS/expiry/generation contract; Recompose has no Home cache backend.                           |
|  36 | Antigravity replay | `TestAntigravityReasoningReplayConditionalReplaceAcceptsDescendantHomeChain`     | N/A     | Distributed Home/KV read/write/CAS/expiry/generation contract; Recompose has no Home cache backend.                           |
|  37 | Antigravity replay | `TestAntigravityReasoningReplayHomeGenerationRejectsSuccessfulValueABA`          | N/A     | Distributed Home/KV read/write/CAS/expiry/generation contract; Recompose has no Home cache backend.                           |
|  38 | Antigravity replay | `TestAntigravityReasoningReplayHomeReportsCASErrors`                             | N/A     | Distributed Home/KV read/write/CAS/expiry/generation contract; Recompose has no Home cache backend.                           |
|  39 | Antigravity replay | `TestAntigravityReasoningReplayHomeCASRetryRejectsOversizedValue`                | N/A     | Distributed Home/KV read/write/CAS/expiry/generation contract; Recompose has no Home cache backend.                           |
|  40 | Antigravity replay | `TestAntigravityReasoningReplayLocalTombstonesStayWithinEntryBound`              | Covered | Exact-named test: `packages/engine/src/subscription/antigravity-replay-state-parity.test.ts:77`                               |
|  41 | Antigravity replay | `TestAntigravityReasoningReplayLocalAbsenceReservationsStayWithinEntryBound`     | Covered | Exact-named test: `packages/engine/src/subscription/antigravity-replay-state-parity.test.ts:85`                               |
|  42 | Antigravity replay | `TestAntigravityReasoningReplayHomeWritesRemainLegacyArrayReadable`              | N/A     | Distributed Home/KV read/write/CAS/expiry/generation contract; Recompose has no Home cache backend.                           |
|  43 | Antigravity replay | `TestAntigravityReasoningReplayHomeReadNormalizesAndRejectsMixedInvalidChain`    | N/A     | Distributed Home/KV read/write/CAS/expiry/generation contract; Recompose has no Home cache backend.                           |
|  44 | Signature cache    | `TestCacheSignature_BasicStorageAndRetrieval`                                    | Covered | Exact-named test: `packages/engine/src/provider/cache-foundation-parity.test.ts:34`                                           |
|  45 | Signature cache    | `TestGetCachedSignatureRequiredHomeReadAndSlidingExpire`                         | N/A     | Distributed Home/KV read/write/CAS/expiry/generation contract; Recompose has no Home cache backend.                           |
|  46 | Signature cache    | `TestGetCachedSignatureRequiredHomeFailures`                                     | N/A     | Distributed Home/KV read/write/CAS/expiry/generation contract; Recompose has no Home cache backend.                           |
|  47 | Signature cache    | `TestGetCachedSignatureRequiredHomeMissDoesNotFallbackToLocalCache`              | N/A     | Distributed Home/KV read/write/CAS/expiry/generation contract; Recompose has no Home cache backend.                           |
|  48 | Signature cache    | `TestCacheSignatureBestEffortHomeWriteFailureDoesNotUseLocalCache`               | N/A     | Distributed Home/KV read/write/CAS/expiry/generation contract; Recompose has no Home cache backend.                           |
|  49 | Signature cache    | `TestDeleteCachedSignatureRequiredHomeExactKey`                                  | N/A     | Distributed Home/KV read/write/CAS/expiry/generation contract; Recompose has no Home cache backend.                           |
|  50 | Signature cache    | `TestClearSignatureCacheHomeDoesNotPrefixDelete`                                 | N/A     | Distributed Home/KV read/write/CAS/expiry/generation contract; Recompose has no Home cache backend.                           |
|  51 | Signature cache    | `TestGetCachedSignatureRequiredGeminiEmptyThinkingSentinel`                      | N/A     | Distributed Home/KV read/write/CAS/expiry/generation contract; Recompose has no Home cache backend.                           |
|  52 | Signature cache    | `TestCacheSignature_DifferentModelGroups`                                        | Covered | Exact-named test: `packages/engine/src/provider/cache-foundation-parity.test.ts:41`                                           |
|  53 | Signature cache    | `TestCacheSignature_NotFound`                                                    | Covered | Exact-named test: `packages/engine/src/provider/cache-foundation-parity.test.ts:49`                                           |
|  54 | Signature cache    | `TestCacheSignature_EmptyInputs`                                                 | Covered | Exact-named test: `packages/engine/src/provider/cache-foundation-parity.test.ts:53`                                           |
|  55 | Signature cache    | `TestCacheSignature_ShortSignatureRejected`                                      | Covered | Exact-named test: `packages/engine/src/provider/cache-foundation-parity.test.ts:57`                                           |
|  56 | Signature cache    | `TestClearSignatureCache_ModelGroup`                                             | Covered | Exact-named test: `packages/engine/src/provider/cache-foundation-parity.test.ts:61`                                           |
|  57 | Signature cache    | `TestClearSignatureCache_AllSessions`                                            | Covered | Exact-named test: `packages/engine/src/provider/cache-foundation-parity.test.ts:71`                                           |
|  58 | Signature cache    | `TestHasValidSignature`                                                          | Covered | Exact-named test: `packages/engine/src/provider/cache-foundation-parity.test.ts:79`                                           |
|  59 | Signature cache    | `TestCacheSignature_TextHashCollisionResistance`                                 | Covered | Exact-named test: `packages/engine/src/provider/cache-foundation-parity.test.ts:86`                                           |
|  60 | Signature cache    | `TestCacheSignature_UnicodeText`                                                 | Covered | Exact-named test: `packages/engine/src/provider/cache-foundation-parity.test.ts:94`                                           |
|  61 | Signature cache    | `TestCacheSignature_Overwrite`                                                   | Covered | Exact-named test: `packages/engine/src/provider/cache-foundation-parity.test.ts:101`                                          |
|  62 | Signature cache    | `TestCacheSignature_ExpirationLogic`                                             | Covered | Exact-named test: `packages/engine/src/provider/cache-foundation-parity.test.ts:109`                                          |
|  63 | Signature cache    | `TestSignatureModeSetters_LogAtInfoLevel`                                        | N/A     | Upstream global signature-mode logging contract has no local mutable mode/logger API.                                         |
|  64 | Signature cache    | `TestSignatureModeSetters_DoNotRepeatSameStateLogs`                              | N/A     | Upstream global signature-mode logging contract has no local mutable mode/logger API.                                         |
|  65 | Signature cache    | `TestSignatureBypassStrictMode_LogsAtDebugLevel`                                 | N/A     | Upstream global signature-mode logging contract has no local mutable mode/logger API.                                         |

## Implemented local cache foundations

- Kimi generation snapshots, conditional replace/delete, tombstones, ABA fencing, byte accounting, oversize and aggregate limits.
- Antigravity branch-aware descendant CAS, non-prefix rotation, tombstone/absence reservations, eviction fences, and bounded entries.
- Concurrent bounded LRU with single constructor per key.
- UTF-8 SHA-256 signature keys, collision resistance, model scoping, overwrite/clear, minimum signature checks, and TTL expiration.

## Verification

- Focused final cache suite: **10 files passed, 74 tests passed**.
- Scoped Oxlint, TypeScript, formatting, and `git diff --check` passed for the implemented cache files.
- Final full-engine checks are currently affected only by unrelated concurrent Claude-signature and subscription reach/transport changes.

No Home/distributed, plugin, router, or ledger changes were included.
