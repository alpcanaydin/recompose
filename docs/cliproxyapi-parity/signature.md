<!-- vale off -->

# Internal signature final reconciliation

## Scope and result

- Upstream: `router-for-me/CLIProxyAPI` commit `8392b180ce3789eba9fd06ebc812b4fc237876e1`.
- Corpus: every top-level `Test*` under `internal/signature`.
- Inventory: **97** rows.
- Final status: **89 covered**, **8 justified N/A**, **0 gaps**.
- Excluded: plugins, routers, and ledger work.

N/A is limited to upstream compatibility-target modes and implementation-specific first-character/lookup-table prefilters that Recompose does not use. All provider signature validation, sanitation, replay, carrier, pairing, bounds, and observability behavior in scope is covered.

## Evidence clusters

- `CLAUDE`: strict classic/CAIS protobuf structure, legacy E/R policy, request sanitation.
- `GEMINI`: relaxed/strict inspector options, text-vs-function discrimination, sanitation and pairing.
- `XAI`: canonical unpadded base64, provider discrimination, size/entropy bounds, replay/compaction sanitation.
- `CODEX`: Fernet/base64url envelope validation and outbound sanitation.
- `CARRIERS`: Claude/Gemini/Codex carrier and replay round trips.
- `OBS`: structured signature sanitizer decisions with no raw-signature leakage.

## Complete row map

|   # | Upstream test                                                                           | Status  | Evidence                                                                                 |
| --: | --------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------- |
|   1 | TestSanitizeClaudeMessagesForClaudeUpstreamPreservesEmptyThinkingInCompatMode           | N/A     | Upstream API-key compatibility-target mode; direct Claude subscription is strict.        |
|   2 | TestSanitizeClaudeMessagesForClaudeUpstreamPreservesOpaqueThinkingSignatureInCompatMode | N/A     | Same absent compatibility-target mode.                                                   |
|   3 | TestStripInvalidClaudeThinkingBlocks_RemovesGPTEncryptedContent                         | covered | CLAUDE/CODEX                                                                             |
|   4 | TestStripInvalidClaudeThinkingBlocksAndEmptyMessages_DropsMessagesLeftEmpty             | covered | CLAUDE                                                                                   |
|   5 | TestStripInvalidClaudeThinkingBlocks_RemovesMalformedEPrefix                            | covered | CLAUDE                                                                                   |
|   6 | TestStripInvalidClaudeThinkingBlocks_Base64OnlyKeepsDecodableEPrefix                    | N/A     | Permissive upstream `Base64Only` compatibility option is not exposed.                    |
|   7 | TestStripInvalidClaudeThinkingBlocks_Base64OnlyRemovesInvalidBase64                     | N/A     | Same compatibility-only validation mode.                                                 |
|   8 | TestStripInvalidClaudeThinkingBlocks_AllowsEmptySignatureEmptyTextPlaceholder           | N/A     | Explicit upstream placeholder compatibility option.                                      |
|   9 | TestStripInvalidClaudeThinkingBlocks_StrictRemovesMalformedClaudeTree                   | covered | CLAUDE exact-named strict-tree proof.                                                    |
|  10 | TestStripInvalidClaudeThinkingBlocks_KeepsClaudeSignaturePrefixes                       | covered | CLAUDE                                                                                   |
|  11 | TestClaudeCAISSignature_ObservedFable5Sample                                            | covered | CLAUDE                                                                                   |
|  12 | TestClaudeCAISSignature_DetectSignatureProvider                                         | covered | CLAUDE/CARRIERS                                                                          |
|  13 | TestClaudeCAISSignature_ObservedOpus5Layout                                             | covered | CLAUDE                                                                                   |
|  14 | TestClaudeCAISSignature_NotCompatibleWithGemini                                         | covered | CLAUDE/GEMINI                                                                            |
|  15 | TestClaudeCAISSignature_CompatibleWithAllClaudeTargets                                  | covered | CLAUDE                                                                                   |
|  16 | TestSanitizeClaudeMessagesForClaudeUpstream_ClaudeCAIS                                  | covered | CLAUDE                                                                                   |
|  17 | TestClaudeCAISSignature_ToleratesUpstreamFieldDrift                                     | covered | CLAUDE structural optional-field policy.                                                 |
|  18 | TestClaudeCAISSignature_RejectsMalformedPayloads                                        | covered | CLAUDE exact-named CAIS malformed matrix.                                                |
|  19 | TestClaudeCAISSignature_DoesNotShadowClassicClaudeSignature                             | covered | CLAUDE                                                                                   |
|  20 | TestClaudeCAISSignature_CachePrefixSurvivesClaudeUpstreamSanitize                       | covered | CLAUDE                                                                                   |
|  21 | TestCompatibleAntigravityClaudeThinkingSignature_RejectsClaudeCAIS                      | covered | CLAUDE/CARRIERS                                                                          |
|  22 | TestSanitizeGeminiRequestThoughtSignaturesPreservesGeminiSignature                      | covered | GEMINI                                                                                   |
|  23 | TestSanitizeGeminiRequestThoughtSignaturesNormalizesDuplicateCanonicalField             | covered | GEMINI                                                                                   |
|  24 | TestSanitizeGeminiRequestThoughtSignaturesParallelSyntheticOnlyFirstGetsBypass          | covered | GEMINI                                                                                   |
|  25 | TestSanitizeGeminiRequestThoughtSignaturesNativeParallelPreservesUnsignedSibling        | covered | GEMINI                                                                                   |
|  26 | TestSanitizeGeminiRequestThoughtSignaturesRemovesPollutedSiblingBypass                  | covered | GEMINI                                                                                   |
|  27 | TestSanitizeGeminiRequestThoughtSignaturesRemovesPrefixedSiblingBypass                  | covered | GEMINI                                                                                   |
|  28 | TestSanitizeGeminiRequestThoughtSignaturesLeavesUnsignedThoughtUnsigned                 | covered | GEMINI                                                                                   |
|  29 | TestSanitizeGeminiRequestThoughtSignaturesReusesUnsignedFunctionResponsePayload         | covered | GEMINI                                                                                   |
|  30 | TestSanitizeGeminiRequestThoughtSignaturesReplacesBase64UUIDFunctionCall                | covered | GEMINI                                                                                   |
|  31 | TestSanitizeGeminiRequestThoughtSignaturesLogsBypassReplacement                         | covered | OBS exact-named structured decision proof.                                               |
|  32 | TestSanitizeGeminiRequestThoughtSignaturesPreservesField2WrappedUUIDFunctionCall        | covered | GEMINI                                                                                   |
|  33 | TestSanitizeGeminiRequestThoughtSignaturesRemovesFunctionResponseSignature              | covered | GEMINI                                                                                   |
|  34 | TestInspectGeminiThoughtSignature_AcceptsOpaqueBase64                                   | covered | GEMINI exact-named relaxed inspection proof.                                             |
|  35 | TestInspectGeminiThoughtSignature_AcceptsGemini31ProField2Envelope                      | covered | GEMINI                                                                                   |
|  36 | TestInspectGeminiThoughtSignature_AcceptsCapturedGemini31FlashLiteEnvelope              | covered | GEMINI                                                                                   |
|  37 | TestInspectGeminiThoughtSignature_AcceptsGemini3WrappedUUIDEnvelope                     | covered | GEMINI                                                                                   |
|  38 | TestInspectGeminiThoughtSignature_RejectsGemini25Field1Envelope                         | covered | GEMINI relaxed unknown vs strict envelope behavior.                                      |
|  39 | TestInspectGeminiThoughtSignature_RejectsMalformedKnownEnvelope                         | covered | GEMINI                                                                                   |
|  40 | TestInspectGeminiThoughtSignature_ClassifiesASCIIUUIDAsOpaque                           | covered | GEMINI exact-named classification proof.                                                 |
|  41 | TestInspectGeminiThoughtSignature_ObservedMarkerOption                                  | covered | GEMINI exact-named option proof.                                                         |
|  42 | TestInspectGeminiThoughtSignature_BypassSentinelRequiresOption                          | covered | GEMINI exact-named option proof.                                                         |
|  43 | TestInspectGeminiThoughtSignature_RejectsInvalidBase64                                  | covered | GEMINI                                                                                   |
|  44 | TestValidateGeminiThoughtSignatures_FirstFunctionCallRequiresSignature                  | covered | GEMINI sanitation equivalent.                                                            |
|  45 | TestValidateGeminiThoughtSignatures_AllowsUnsignedParallelSibling                       | covered | GEMINI                                                                                   |
|  46 | TestValidateGeminiThoughtSignatures_RejectsSentinelOutsideFirstFunctionCall             | covered | GEMINI                                                                                   |
|  47 | TestValidateGeminiThoughtSignatures_RejectsNonCanonicalNestedSignature                  | covered | GEMINI                                                                                   |
|  48 | TestValidateGeminiThoughtSignatures_AcceptsWrappedRequestAndSentinelWhenAllowed         | covered | GEMINI                                                                                   |
|  49 | TestValidateGeminiThoughtSignatures_RejectsInvalidTextPartSignature                     | covered | GEMINI text/function discrimination.                                                     |
|  50 | TestValidateGeminiFunctionCallPairing_ValidParallelGroup                                | covered | GEMINI pairing preflight.                                                                |
|  51 | TestValidateGeminiFunctionCallPairing_RejectsUserBoundaryBeforeResponse                 | covered | GEMINI pairing preflight.                                                                |
|  52 | TestValidateGeminiFunctionCallPairing_RejectsEmptyContentBoundaryBeforeResponse         | covered | GEMINI pairing preflight.                                                                |
|  53 | TestValidateGeminiFunctionCallPairing_RejectsResponseCountMismatch                      | covered | GEMINI pairing preflight.                                                                |
|  54 | TestValidateGeminiFunctionCallPairing_RejectsMissingFunctionCallName                    | covered | GEMINI pairing preflight.                                                                |
|  55 | TestValidateGeminiFunctionCallPairing_RejectsIDMismatch                                 | covered | GEMINI pairing preflight.                                                                |
|  56 | TestValidateGeminiFunctionCallPairing_RejectsMissingResponseName                        | covered | GEMINI pairing preflight.                                                                |
|  57 | TestValidateGeminiFunctionCallPairing_RejectsSameContentInterleaving                    | covered | GEMINI pairing preflight.                                                                |
|  58 | TestIsValidGeminiThoughtSignature_AgyNativeSamples                                      | covered | GEMINI/CARRIERS                                                                          |
|  59 | TestDetectSignatureProvider_GPTReasoning                                                | covered | CODEX                                                                                    |
|  60 | TestInspectGPTReasoningSignatureRejectsUnicodeEllipsis                                  | covered | CODEX                                                                                    |
|  61 | TestInspectGrokEncryptedContent_NativeSamples                                           | covered | XAI exact-named variable-length native proof.                                            |
|  62 | TestInspectGrokEncryptedContent_RejectsAgyGeminiThoughtSignatures                       | covered | XAI/GEMINI                                                                               |
|  63 | TestInspectGrokEncryptedContent_RejectsGeminiThoughtSignatureEnvelope                   | covered | XAI/GEMINI                                                                               |
|  64 | TestInspectGrokEncryptedContent_RetiredGemini25Field1Envelope                           | covered | XAI residual opaque acceptance.                                                          |
|  65 | TestInspectGrokEncryptedContent_RejectsClaudeThinkingSignature                          | covered | XAI/CLAUDE                                                                               |
|  66 | TestInspectGrokEncryptedContent_RejectsAntigravityClaudeThinkingSignature               | covered | XAI/CLAUDE                                                                               |
|  67 | TestInspectGrokEncryptedContent_RejectsClaudeCAISSignature                              | covered | XAI exact-named structural CAIS rejection.                                               |
|  68 | TestInspectGrokEncryptedContent_RejectsProviderCachePrefix                              | covered | XAI exact-named prefix proof.                                                            |
|  69 | TestInspectGrokEncryptedContent_ThresholdMargins                                        | covered | XAI exact-named 32-byte/0.85/8 MiB bounds.                                               |
|  70 | TestInspectGrokEncryptedContent_RejectsForeignShapes                                    | covered | XAI                                                                                      |
|  71 | TestInspectGrokEncryptedContent_RejectsLowEntropyPayload                                | covered | XAI exact-named entropy proof.                                                           |
|  72 | TestInspectGrokEncryptedContent_RejectsInvalidBase64Length                              | covered | XAI                                                                                      |
|  73 | TestByteEntropyRatio_SingleByteReturnsZero                                              | covered | XAI exact-named entropy helper proof.                                                    |
|  74 | TestBase64AlphabetSet_MatchesEncoderAlphabets                                           | N/A     | Recompose uses canonical decoder round-trips, not byte lookup tables.                    |
|  75 | TestSelfDescribingSignatureFirstChars_CoversEveryKnownEnvelope                          | N/A     | Recompose directly invokes provider validators, with no first-character prefilter table. |
|  76 | TestGeminiASCIIUUIDIsGateIndependent                                                    | N/A     | Depends on the absent upstream first-character prefilter.                                |
|  77 | TestDetectSignatureProviderForBlock_ClassifiesEveryKnownEnvelope                        | covered | CLAUDE/GEMINI/CODEX/CARRIERS                                                             |
|  78 | TestGeminiEnvelopeNeverClaimsClaudeSignatures                                           | covered | CLAUDE/GEMINI exact-named cross-provider proof.                                          |
|  79 | TestDetectSignatureProvider_UsesProviderPrefix                                          | covered | Provider prefix validators.                                                              |
|  80 | TestDetectSignatureProvider_RejectsMisleadingClaudePrefix                               | covered | Strict prefix plus structure validation.                                                 |
|  81 | TestDetectSignatureProvider_Gemini3EPrefixDoesNotLookClaude                             | covered | CLAUDE/GEMINI exact-named E-prefix proof.                                                |
|  82 | TestCompatibleSignatureForProvider_ClaudeUsesProviderNativeEForm                        | covered | CLAUDE                                                                                   |
|  83 | TestCompatibleAntigravityClaudeThinkingSignature_UsesDoubleLayerRForm                   | covered | CLAUDE                                                                                   |
|  84 | TestCompatibleAntigravityClaudeThinkingSignature_RejectsGeminiEPrefix                   | covered | CLAUDE/GEMINI                                                                            |
|  85 | TestDetectSignatureProvider_DoesNotClassifyArbitraryBase64AsGemini                      | covered | GEMINI strict replay gate.                                                               |
|  86 | TestGeminiASCIIUUIDSignatureUsesBypass                                                  | covered | GEMINI                                                                                   |
|  87 | TestGeminiWrappedUUIDFunctionCallSignatureIsCompatible                                  | covered | GEMINI                                                                                   |
|  88 | TestCompatibleSignatureForProvider_StripsGeminiPrefix                                   | covered | GEMINI                                                                                   |
|  89 | TestSplitSignatureProviderPrefix_UsesStrictProviderAliases                              | covered | Provider alias sets.                                                                     |
|  90 | TestDecideSignatureCompatibility_GeminiFunctionCallUsesBypass                           | covered | GEMINI                                                                                   |
|  91 | TestSanitizeClaudeMessagesSignaturesForModel_NormalizesSameProviderClaude               | covered | CLAUDE                                                                                   |
|  92 | TestSanitizeClaudeMessagesSignaturesForModel_DropsClaudeThinkingForGemini               | covered | CARRIERS                                                                                 |
|  93 | TestSanitizeClaudeMessagesSignaturesForModel_PreservesGeminiThinkingForGemini           | covered | GEMINI/CARRIERS                                                                          |
|  94 | TestSanitizeClaudeMessagesSignaturesForModel_PreservesGPTForGPT                         | covered | CODEX                                                                                    |
|  95 | TestSanitizeClaudeMessagesSignaturesForModel_DropsEmptyAssistantMessage                 | covered | CLAUDE                                                                                   |
|  96 | TestSanitizeClaudeMessagesForClaudeUpstream_DropsInvalidThinkingAndCleansToolUse        | covered | CLAUDE                                                                                   |
|  97 | TestSanitizeClaudeMessagesForClaudeUpstream_NormalizesValidThinkingAndDropsEmptyMessage | covered | CLAUDE                                                                                   |

## Final implementation summary

- Claude: strict classic and CAIS protobuf discrimination is used for outbound sanitation and Antigravity conversion; permissive legacy recognition remains available for cached compatibility paths.
- Gemini: relaxed inspection supports opaque signed text, strict known-envelope mode protects function replay, bypass and observed-marker behavior is option-scoped, and pairing preflight rejects malformed tool history.
- xAI: replay-safe residual ciphertext requires canonical unpadded standard base64, provider provenance separation, 32-byte decoded minimum, 8 MiB raw cap, and entropy ratio at least 0.85.
- Codex: Fernet/base64url reasoning envelopes are preserved only when structurally valid.
- Observability: signature sanitation emits structured action/provider/block/index/length decisions without raw signature content.

## Verification

- Exact upstream `go test ./internal/signature`: 97 tests passed.
- Focused Recompose signature suite: 16 files, 111 tests passed.
- Full engine and global gates are reported in the accompanying final handoff.
