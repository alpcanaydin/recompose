<!-- vale off -->

# Final internal auth parity reconciliation

Scope: all 46 upstream `internal/auth` tests. Raw CLIProxy auth-file management, external CLI-owned OAuth onboarding/code exchange, plugin auth, and unsupported Kimi/xAI subscription OAuth remain N/A.

## Verification

- Accounting: 46/46 rows exactly once.
- Final status: Covered 26, N/A 20, Gap 0.
- Exact reliability/proxy/resumption parity tests are present locally.

|   # | Upstream test                                                                 | Status  | Local evidence / rationale                                                                                             |
| --: | ----------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------- |
|   1 | `TestFetchProjectIDFromLoadCodeAssist`                                        | N/A     | Antigravity onboarding/project discovery is owned by the external CLI; Recompose consumes its credential bundle.       |
|   2 | `TestFetchProjectIDFallsBackToDailyOnboardUser`                               | N/A     | External CLI onboarding behavior; serving fallback is covered separately.                                              |
|   3 | `TestNewDeviceFlowClientWithDeviceIDAndProxyURL_OverrideDirectDisablesProxy`  | N/A     | Recompose has no Kimi OAuth/device-flow subscription provider.                                                         |
|   4 | `TestNewDeviceFlowClientWithDeviceIDAndProxyURL_OverrideProxyTakesPrecedence` | N/A     | Same unsupported Kimi OAuth scope.                                                                                     |
|   5 | `TestRefreshToken_DeduplicatesConcurrentRefreshAcrossInstances`               | N/A     | Kimi OAuth refresh is unsupported.                                                                                     |
|   6 | `TestValidateOAuthEndpointRejectsNonXAIOrigin`                                | N/A     | xAI is a credentialed provider account, not a subscription OAuth flow.                                                 |
|   7 | `TestRequestDeviceCodePostsClientIDAndScope`                                  | N/A     | xAI device-code sign-in is unsupported.                                                                                |
|   8 | `TestPollForTokenExchangesDeviceCode`                                         | N/A     | Same.                                                                                                                  |
|   9 | `TestPollForTokenAccessDenied`                                                | N/A     | Same.                                                                                                                  |
|  10 | `TestPollForTokenSlowDownContinuesPolling`                                    | N/A     | Same.                                                                                                                  |
|  11 | `TestBuildTokenDataOmitsExpireWhenExpiresInZero`                              | N/A     | Recompose does not parse xAI OAuth token bundles.                                                                      |
|  12 | `TestRefreshTokensPostsClientIDAndRefreshToken`                               | N/A     | xAI OAuth refresh is unsupported.                                                                                      |
|  13 | `TestRefreshTokens_DeduplicatesConcurrentRefresh`                             | N/A     | Same.                                                                                                                  |
|  14 | `TestCredentialFileName`                                                      | N/A     | Raw CLIProxy auth-file naming is excluded; Recompose uses opaque account homes/IDs.                                    |
|  15 | `TestNewCodexAuthDoesNotSetRequestTimeout`                                    | N/A     | Interactive Codex auth-client construction belongs to the external Codex CLI.                                          |
|  16 | `TestRefreshTokens_UsesIndependentTimeout`                                    | Covered | Exact test in `refresh-deadline-parity.test.ts`; shared Codex refresh owns a finite 30s signal.                        |
|  17 | `TestRefreshTokensWithRetry_NonRetryableOnlyAttemptsOnce`                     | Covered | `refresh.test.ts` proves one Codex exchange with no automatic retry.                                                   |
|  18 | `TestRefreshTokens_DeduplicatesConcurrentRefreshAcrossInstances`              | Covered | Exact test proves module-wide provider/token single-flight.                                                            |
|  19 | `TestNewCodexAuthWithProxyURL_OverrideDirectDisablesProxy`                    | Covered | Exact transport test; per-account `direct` becomes `node-wreq` `proxy: false` for serving and refresh.                 |
|  20 | `TestNewCodexAuthWithProxyURL_OverrideProxyTakesPrecedence`                   | Covered | Exact test; validated account proxy URL reaches both Codex serving and refresh options.                                |
|  21 | `TestReadClaudeOAuthResponseBodyDecodesStackedRepeatedHeaders`                | Covered | Claude compression tests decode stacked encodings in reverse order.                                                    |
|  22 | `TestReadClaudeOAuthResponseBodyDecodesAdvertisedEncodings`                   | Covered | Parameterized gzip/deflate/Brotli/zstd coverage.                                                                       |
|  23 | `TestGenerateDeviceIDPool`                                                    | Covered | `claude-identity.test.ts` pins canonical lowercase 64-hex device IDs.                                                  |
|  24 | `TestReadDeviceIDPoolReturnsDefensiveCopy`                                    | N/A     | No mutable device-pool accessor exists; parsing produces fresh values.                                                 |
|  25 | `TestEnsureDeviceIDPoolRepairsAndStabilizesCredentialMetadata`                | Covered | Credential parsing normalizes malformed/multiple device metadata and persistence stabilizes it.                        |
|  26 | `TestEnsureDeviceIDPoolCanonicalizesSingleDevice`                             | Covered | Parser validates and retains one canonical device ID.                                                                  |
|  27 | `TestEnsureDeviceIDPoolMigratesFiveSlotsToOne`                                | Covered | Exact migration parity test retains the first device and persists once.                                                |
|  28 | `TestEnsureDeviceIDPoolConcurrentInitialization`                              | Covered | Exact test proves per-account/token single-flight, convergence, recheck, and one persistence write.                    |
|  29 | `TestSelectDeviceIDUsesOneDeviceAcrossSessions`                               | Covered | Parsed credentials always reuse their single persisted device.                                                         |
|  30 | `TestUtlsRoundTripperBoundsTLSHandshake`                                      | Covered | Exact test pins the Claude OAuth 10s connection/TLS establishment bound.                                               |
|  31 | `TestClaudeOAuthTLSClientHelloSpecMatchesNative220Capture`                    | Covered | Provider transport test pins the captured OAuth JA3/extension order.                                                   |
|  32 | `TestClaudeOAuthTLSResumptionIsWireSafe`                                      | Covered | Exact test proves refresh/profile endpoints share bounded session-cache and session-ticket/PSK/PSK-DHE safety options. |
|  33 | `TestClaudeOAuthSessionCacheBoundsProxyCardinality`                           | Covered | OAuth transport cache capacity is fixed at 8 and tested.                                                               |
|  34 | `TestClaudeOAuthRequestHeaderOrderMatchesNative220Capture`                    | Covered | Claude request/transport tests pin ordered native headers.                                                             |
|  35 | `TestNewAnthropicHttpClientDoesNotSetRequestTimeout`                          | N/A     | Interactive Claude auth-client construction belongs to Claude Code.                                                    |
|  36 | `TestRefreshTokens_UsesIndependentTimeout`                                    | Covered | Exact Claude test proves the shared refresh owns a finite 30s signal.                                                  |
|  37 | `TestExchangeCodeForTokensPersistsUpstreamAccountAndDevicePool`               | N/A     | Claude Code owns interactive exchange; Recompose consumes and repairs its credential.                                  |
|  38 | `TestExchangeCodeForTokensUsesNative220ControlPlaneShape`                     | N/A     | Code exchange is external; locally owned refresh/profile shapes are covered.                                           |
|  39 | `TestExchangeCodeForTokensSurvivesCompanionLookupFailure`                     | N/A     | External Claude Code onboarding behavior.                                                                              |
|  40 | `TestRefreshTokensWithRetry_429BlocksImmediateReplay`                         | Covered | Rate-limit test proves Retry-After blocking by refresh token.                                                          |
|  41 | `TestRefreshTokens_DeduplicatesConcurrentRefresh`                             | Covered | Claude refresh single-flight test makes one upstream request.                                                          |
|  42 | `TestRefreshTokensUsesNative220ControlPlaneShape`                             | Covered | Refresh test pins URL, body, scope, headers, and connection-close shape.                                               |
|  43 | `TestFetchOAuthProfile`                                                       | Covered | Profile transport test pins authenticated native request and decoded account UUID.                                     |
|  44 | `TestUpdateTokenStoragePreservesAccountWhenRefreshOmitsIt`                    | Covered | Credential tests preserve account/device/unrelated fields across refresh and persist the complete bundle.              |
|  45 | `TestNewClaudeAuthWithProxyURL_OverrideDirectTakesPrecedence`                 | Covered | Exact test; per-account `direct` disables proxies for serving and OAuth transport.                                     |
|  46 | `TestNewClaudeAuthWithProxyURL_OverrideProxyAppliedWithoutConfig`             | Covered | Exact test; validated SOCKS proxy applies to serving, refresh, and profile lookup without global config.               |

## Policy and custody notes

- Accounts schema version 6 adds optional strict `transportPolicy`: `inherit`, `direct`, or `proxy`.
- Proxy URLs accept only HTTP(S)/SOCKS5(SOCKS5H) and reject embedded credentials because accounts storage is not the secret vault.
- Public subscription views continue to omit transport policy and credentials.
- Ledger files were not modified.
