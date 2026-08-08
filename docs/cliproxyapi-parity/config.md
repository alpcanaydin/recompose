<!-- vale off -->

# `internal/config` final parity reconciliation

Scope: all 48 upstream `Test*` functions under
`/private/tmp/cliproxyapi-reference/internal/config`, reconciled against the current Recompose
contracts, engine, provider transports, and explicit architecture exclusions.

## Final accounting

- **Covered: 22**
- **N/A: 26**
- **Gap: 0**
- **Rows accounted for: 48/48 exactly once**

Recompose persists strict typed account and gateway documents rather than loading CLIProxy's
monolithic YAML/JSON configuration. Raw parser, clone, plugin, router-weight, Home, and fixture-wire
contracts therefore remain N/A. Runtime/provider semantics are covered where Recompose owns an
equivalent surface.

Codex Live media relay is also N/A. It is a separate `/v1/realtime/calls` WebRTC/SDP transport with
ICE servers, UDP candidate ports, and in-process media sessions. Recompose implements OpenAI
Responses HTTP/SSE and Responses WebSocket, not this WebRTC relay. Official OpenAI Realtime guidance
likewise distinguishes WebRTC media negotiation from WebSocket event transport; adding relay-only
configuration without the corresponding transport would create a dead contract.

## Row-level reconciliation

|   # | Seam                   | Upstream test                                                               | Final   | Evidence or rationale                                                                                                                                                                                                 |
| --: | ---------------------- | --------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   1 | Codex headers          | `TestLoadConfigOptional_CodexHeaderDefaults`                                | Covered | `packages/engine/src/provider/codex-websocket-parity.test.ts` covers canonical Codex WebSocket headers and prompt-cache/session identity.                                                                             |
|   2 | Codex headers          | `TestLoadConfigOptional_CodexIdentityConfuse`                               | Covered | `packages/engine/src/provider/codex-websocket-parity.test.ts` covers request identity remapping and response-ID restoration.                                                                                          |
|   3 | Credential lifecycle   | `TestCredentialConcurrencyLifecycleFixture`                                 | Covered | Exact-named parity test in `packages/engine/src/subscription/credential-runtime-policy-parity.test.ts`; defaults and lifecycle validation live in `credential-policy-defaults.ts` and `credential-runtime-policy.ts`. |
|   4 | Clone/parser           | `TestCloneForRuntimeNil`                                                    | N/A     | CLIProxy monolithic config cloning has no typed-document equivalent.                                                                                                                                                  |
|   5 | Clone/parser           | `TestParseConfigBytes_AntigravitySensitiveWords`                            | N/A     | Raw YAML parsing is outside Recompose; runtime sensitive-word policy is independently typed.                                                                                                                          |
|   6 | Clone/parser           | `TestCloneForRuntimeDeepCopiesConfig`                                       | N/A     | Recompose does not clone a monolithic runtime config graph.                                                                                                                                                           |
|   7 | Clone/parser           | `TestCloneForRuntimeDoesNotShareReferenceFields`                            | N/A     | Same excluded clone contract.                                                                                                                                                                                         |
|   8 | Claude headers         | `TestLoadConfigOptional_ClaudeHeaderDefaults`                               | Covered | `packages/engine/src/subscription/claude-request.test.ts` and Claude wire-header modules cover fixed User-Agent, beta, session, originator, and identity headers.                                                     |
|   9 | Live media relay       | `TestCodexLiveMediaRelayConfigParsesAndValidates`                           | N/A     | Recompose has no Codex Live `/v1/realtime/calls` WebRTC/SDP media relay; `docs/cliproxyapi-parity/client.md` explicitly excludes this transport.                                                                      |
|  10 | Live media relay       | `TestCodexLiveMediaRelayConfigMigratesLegacyPrivateIPSetting`               | N/A     | Legacy private ICE-candidate migration only applies to the absent WebRTC relay configuration.                                                                                                                         |
|  11 | Live media relay       | `TestCodexLiveMediaRelayConfigRejectsInvalidValues`                         | N/A     | ICE URLs, public candidate IPs, UDP ranges, and relay session limits are not meaningful for the implemented Responses WebSocket transport.                                                                            |
|  12 | xAI capability         | `TestSanitizeXAIKeysClearsCodexAlphaSearchCapability`                       | Covered | xAI native tool ownership and search normalization are covered by `packages/engine/src/provider/xai-tool-ownership.ts` and xAI request/tool tests.                                                                    |
|  13 | Claude cloaking        | `TestParseConfigBytesClaudeCodeModelListCloaking`                           | Covered | `packages/engine/src/subscription/claude-payload-policy-parity.test.ts` and Claude system tests cover configured cloaking behavior.                                                                                   |
|  14 | Model policy           | `TestAPIKeyModelIsCompatConfigDecoding`                                     | N/A     | CLIProxy `is_compat` YAML decoding has no local config-file field or parser seam.                                                                                                                                     |
|  15 | Model policy           | `TestSanitizeOAuthModelAlias_PreservesOptionalFields`                       | Covered | `packages/contracts/src/model-policy.test.ts` covers normalized aliases with optional display names.                                                                                                                  |
|  16 | Model policy           | `TestSanitizeOAuthModelAlias_AllowsMultipleAliasesForSameName`              | Covered | Typed provider model policy preserves multiple aliases for a provider model.                                                                                                                                          |
|  17 | Plugin config          | `TestParseConfigBytes_PluginsDefaults`                                      | N/A     | Plugin configuration is explicitly excluded.                                                                                                                                                                          |
|  18 | Plugin config          | `TestParseConfigBytes_PluginsDirExpandsLeadingTilde`                        | N/A     | Plugin directory parsing is explicitly excluded.                                                                                                                                                                      |
|  19 | Plugin config          | `TestLoadConfig_PluginsDirExpandsLeadingTilde`                              | N/A     | Plugin directory loading is explicitly excluded.                                                                                                                                                                      |
|  20 | Plugin config          | `TestParseConfigBytes_PluginStoreSources`                                   | N/A     | Plugin store configuration is explicitly excluded.                                                                                                                                                                    |
|  21 | Plugin config          | `TestParseConfigBytes_PluginStoreAuth`                                      | N/A     | Plugin store authentication is explicitly excluded.                                                                                                                                                                   |
|  22 | Plugin config          | `TestParseConfigBytes_PluginAuthRevision`                                   | N/A     | Plugin auth revision parsing is explicitly excluded.                                                                                                                                                                  |
|  23 | Plugin config          | `TestParseConfigBytes_PluginInstanceEmptyRawYAML`                           | N/A     | Raw plugin YAML is explicitly excluded.                                                                                                                                                                               |
|  24 | Plugin config          | `TestSaveConfigPreserveComments_PrunesDefaultPluginsDir`                    | N/A     | Recompose does not save CLIProxy YAML or preserve its comments.                                                                                                                                                       |
|  25 | Plugin config          | `TestParseConfigBytes_PluginInstanceRawYAML`                                | N/A     | Raw plugin YAML is explicitly excluded.                                                                                                                                                                               |
|  26 | Model policy           | `TestCodexModelIsCompatConfigDecoding`                                      | N/A     | CLIProxy `is_compat` YAML decoding has no local config-file counterpart.                                                                                                                                              |
|  27 | Router weights         | `TestAPIKeyWeightValidation`                                                | N/A     | Router weight parsing and validation are explicitly excluded.                                                                                                                                                         |
|  28 | Router weights         | `TestAPIKeyWeightParsingAndZeroPersistence`                                 | N/A     | Router weight persistence is explicitly excluded.                                                                                                                                                                     |
|  29 | Model policy           | `TestModelDisplayNameConfigDecoding`                                        | Covered | `packages/contracts/src/model-policy.test.ts` covers configured model display names.                                                                                                                                  |
|  30 | Model policy           | `TestMaxContextLengthConfigDecoding`                                        | Covered | `packages/engine/src/provider/rich-model-registry-parity.test.ts` covers context-length metadata and registry behavior.                                                                                               |
|  31 | Image policy parsing   | `TestDisableImageGenerationMode_UnmarshalYAML`                              | N/A     | YAML enum unmarshalling is a CLI config parser contract; local image behavior is typed at runtime.                                                                                                                    |
|  32 | Image policy parsing   | `TestDisableImageGenerationMode_UnmarshalJSON`                              | N/A     | JSON enum unmarshalling is a CLI config parser contract; local image behavior is typed at runtime.                                                                                                                    |
|  33 | xAI credential         | `TestParseConfigBytesXAIConfig`                                             | Covered | xAI credentialed target/request tests cover API-key custody and request construction.                                                                                                                                 |
|  34 | xAI credential         | `TestParseConfigBytesXAIAPIKeyMatchesCodexShape`                            | Covered | xAI and Codex credentialed target handling share the typed credential-custody contract.                                                                                                                               |
|  35 | Home config            | `TestParseConfigBytesIgnoresHomeConfig`                                     | N/A     | Home configuration and authoritative heartbeat are outside the local architecture.                                                                                                                                    |
|  36 | Credential in-flight   | `TestLoadConfigOptionalMissingFallbackAppliesCredentialInFlightDefaults`    | Covered | Exact-named parity test; typed missing policy resolves to `DEFAULT_CREDENTIAL_IN_FLIGHT_POLICY`.                                                                                                                      |
|  37 | Credential in-flight   | `TestLoadConfigOptionalEmptyFallbackAppliesCredentialInFlightDefaults`      | Covered | Exact-named parity test; an empty typed policy receives all defaults.                                                                                                                                                 |
|  38 | Credential in-flight   | `TestLoadConfigOptionalWhitespaceFallbackAppliesCredentialInFlightDefaults` | Covered | Exact-named parity test adapts rejected non-object input to the optional typed fallback.                                                                                                                              |
|  39 | Credential in-flight   | `TestLoadConfigOptionalInvalidFallbackAppliesCredentialInFlightDefaults`    | Covered | Exact-named parity test adapts invalid optional input to the typed fallback without adding a raw YAML parser.                                                                                                         |
|  40 | Credential in-flight   | `TestCredentialInFlightConfigContractFixture`                               | N/A     | CLI JSON fixture field/tag conformance is not a runtime behavior contract.                                                                                                                                            |
|  41 | Credential in-flight   | `TestCredentialInFlightConfigFixtureRejectsInvalidJSON`                     | N/A     | Invalid/trailing JSON fixture decoding belongs to the excluded raw parser.                                                                                                                                            |
|  42 | Credential in-flight   | `TestCredentialInFlightConfigDurationBounds`                                | Covered | Exact-named parity test covers positive durations, the three-snapshot stale bound, and near-safe-integer rejection.                                                                                                   |
|  43 | Credential in-flight   | `TestCredentialInFlightConfigRejectsUnsafeBounds`                           | Covered | Exact-named parity test covers stale, revision, part, collection, and safe-integer hard bounds.                                                                                                                       |
|  44 | Credential concurrency | `TestCredentialConcurrencyLimiterConfig`                                    | Covered | Exact-named parity test covers defaults, lifecycle timing, per-credential isolation, saturation, and idempotent release.                                                                                              |
|  45 | Credential concurrency | `TestValidateCredentialConcurrencyAcceptsHomeAuthoritativeHeartbeat`        | N/A     | Home-authoritative heartbeat remains outside the Recompose architecture.                                                                                                                                              |
|  46 | Credential concurrency | `TestCredentialConcurrencyConfigDefaultsOnlyMissingFields`                  | Covered | Exact-named parity test verifies partial default merging and rejection of explicit invalid zero/negative lifecycle fields.                                                                                            |
|  47 | Credential concurrency | `TestCredentialConcurrencyConfigRejectsInvalidLimiter`                      | Covered | Exact-named parity test covers release backoff, whole-millisecond retry values, retry ordering, and maximum limits.                                                                                                   |
|  48 | Credential concurrency | `TestValidateCredentialConcurrencyLifecycleRejectsSafetyOverflow`           | Covered | Exact-named parity test covers safe-integer overflow in lifecycle timing sums.                                                                                                                                        |

## Implemented credential policy surface

- `packages/contracts/src/credential-policy.ts` defines strict, partial persisted policy schemas.
- `packages/contracts/src/accounts.ts` permits an optional credential policy on subscription accounts.
- `packages/engine/src/subscription/credential-policy-defaults.ts` applies defaults only to missing fields.
- `packages/engine/src/subscription/credential-runtime-policy.ts` validates in-flight storage/timing,
  concurrency lifecycle/limiter bounds, overflow safety, and provides the per-credential limiter.
- `packages/engine/src/subscription/credential-runtime-policy-parity.test.ts` contains all 11 assigned
  exact-named parity tests.

## Final scope conclusion

Every runtime/provider seam applicable to Recompose is covered. The remaining N/A rows are tied to
surfaces Recompose intentionally does not implement: CLIProxy raw config management, plugins,
router weights, Home, fixture-wire conformance, and Codex Live WebRTC/media relay. No compatibility
shim or inert media-relay configuration is warranted for the implemented Responses WebSocket path.

## Verification

- Contracts full suite: **29 files passed, 403 tests passed**.
- Engine full suite: **302 files passed, 2,140 tests passed**.
- Contracts TypeScript and full Oxlint: passed.
- Engine TypeScript and full Oxlint: passed.
- Credential-policy touched-file formatting: passed.
- `git diff --check`: passed.
- Repository-wide `oxfmt --check packages/contracts/src packages/engine/src` currently reports 11
  unrelated concurrently edited engine files. They were not rewritten as part of this audit.
