<!-- vale off -->

# Small internal packages final reconciliation

Scope: all `Test*` functions in the remaining non-plugin small packages requested from the upstream
reference:

- `internal/httpwire` — 4
- `internal/httpfetch` — 3
- `internal/clienterror` — 2
- `internal/safemode` — 3
- `internal/htmlsanitize` — 2
- `internal/credentialweight` — 1
- `internal/misc` — 8
- `internal/managementasset` — 1

Model configuration was already finalized and is excluded. Plugin, router-weight, Home/raw-config,
and management control-panel assets remain architecture N/A.

## Final accounting

- **Covered: 12**
- **N/A: 12**
- **Gap: 0**
- **Rows accounted for: 24/24 exactly once**

## Row-level reconciliation

|   # | Package            | Upstream test                                                          | Final   | Evidence or rationale                                                                                                                                                                                                                                   |
| --: | ------------------ | ---------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   1 | `httpwire`         | `TestOrderedRequestConnReordersKeepAliveRequestsWithoutChangingBodies` | Covered | `subscription/claude-request.test.ts` pins the first-party ordered header tuples and body; `subscription/provider-transport.test.ts` verifies those ordered tuples and unchanged body reach the native `node-wreq` transport.                           |
|   2 | `httpwire`         | `TestOrderedRequestConnPreservesChunkedBodyAndReordersNextRequest`     | N/A     | Recompose sends buffered provider request bodies and delegates HTTP/1.1 connection framing to `node-wreq`; it has no custom connection wrapper or chunked outbound upload state. This refines the earlier ledger's broader “covered” classification.    |
|   3 | `httpwire`         | `TestOrderedRequestConnReportsPartialBodyWrite`                        | N/A     | Partial socket-write accounting belongs to the upstream custom `net.Conn` wrapper; Recompose delegates it to `node-wreq`.                                                                                                                               |
|   4 | `httpwire`         | `TestOrderedRequestConnTracksOnlyWrittenChunkBytesAfterPartialError`   | N/A     | Same excluded custom connection/chunk tracker; no Recompose state depends on partial written byte counts.                                                                                                                                               |
|   5 | `httpfetch`        | `TestGetBytesReturnsBodyAndSendsHeaders`                               | Covered | `subscription/antigravity-version.test.ts` verifies updater headers and manifest response parsing.                                                                                                                                                      |
|   6 | `httpfetch`        | `TestGetBytesRejectsErrorStatus`                                       | Covered | `subscription/antigravity-version.test.ts` verifies non-success manifest status propagation.                                                                                                                                                            |
|   7 | `httpfetch`        | `TestGetBytesEnforcesMaxSize`                                          | Covered | Newly exact-named local test in `subscription/antigravity-version.test.ts`; the production manifest reader now enforces the upstream 4 KiB streaming bound before decoding.                                                                             |
|   8 | `clienterror`      | `TestIsRequestFaultStructuredIdentifiers`                              | N/A     | The classifier exists to choose credential rotation/cooldown after request-shaped failures. Recompose resolves one explicit account and does not perform hidden router selection. Provider errors still pass through with their structured identifiers. |
|   9 | `clienterror`      | `TestIsRequestFault`                                                   | N/A     | Status/message request-fault classification is likewise part of the deferred router/account-selection policy, not response normalization.                                                                                                               |
|  10 | `safemode`         | `TestExampleAPIKeysDetectsOnlyTemplateValues`                          | N/A     | CLIProxy raw-config template-key safe mode; Recompose stores strict typed accounts and never serves this raw-config gate.                                                                                                                               |
|  11 | `safemode`         | `TestExampleAPIKeysIgnoresSimilarValues`                               | N/A     | Same excluded raw-config template-key detector.                                                                                                                                                                                                         |
|  12 | `safemode`         | `TestExampleAPIKeyWarningPageIncludesManagementButton`                 | N/A     | CLIProxy management HTML and control-panel navigation are not desktop engine behavior.                                                                                                                                                                  |
|  13 | `htmlsanitize`     | `TestJSONBodyEscapesStringValues`                                      | N/A     | Escapes JSON embedded into CLIProxy management/plugin HTML; no equivalent server-rendered management page exists.                                                                                                                                       |
|  14 | `htmlsanitize`     | `TestJSONBodyIfLikelySkipsNonJSONHTML`                                 | N/A     | Same excluded management/plugin HTML response sanitizer.                                                                                                                                                                                                |
|  15 | `credentialweight` | `TestParseValueValidation`                                             | N/A     | Credential weighting belongs to the explicitly deferred router feature.                                                                                                                                                                                 |
|  16 | `misc`             | `TestAntigravityLatestVersionUsesCurrentHubFallback`                   | Covered | `subscription/antigravity-version.test.ts` pins fallback version `2.2.1`.                                                                                                                                                                               |
|  17 | `misc`             | `TestAntigravityUserAgentUsesHubFamily`                                | Covered | Local Antigravity version tests pin the short Hub/platform user agent.                                                                                                                                                                                  |
|  18 | `misc`             | `TestAntigravityVersionFromUserAgentParsesHubFamily`                   | Covered | Local version tests parse the Hub-family user agent.                                                                                                                                                                                                    |
|  19 | `misc`             | `TestAntigravityVersionFromUserAgentParsesLegacyFamily`                | Covered | Local version tests parse the legacy Antigravity family.                                                                                                                                                                                                |
|  20 | `misc`             | `TestAntigravityLoadCodeAssistUserAgentUsesShortUA`                    | Covered | `antigravityRequestUserAgent` and its tests preserve the short runtime/loadCodeAssist user agent.                                                                                                                                                       |
|  21 | `misc`             | `TestAntigravityOnboardUserUserAgentUsesLongUA`                        | Covered | Local tests add the Node API-client suffix only for onboarding/control-plane requests.                                                                                                                                                                  |
|  22 | `misc`             | `TestFetchAntigravityLatestVersionUsesHubManifest`                     | Covered | Local tests verify manifest URL behavior, updater headers, version parsing, and now bounded streaming reads.                                                                                                                                            |
|  23 | `misc`             | `TestFetchAntigravityLatestVersionReturnsHubManifestError`             | Covered | Local tests verify a non-success manifest response rejects.                                                                                                                                                                                             |
|  24 | `managementasset`  | `TestAutoUpdateSkipReason`                                             | N/A     | Control-panel asset update policy depends on Home/cluster mode and remote-management flags; Recompose does not ship or auto-update CLIProxy management HTML.                                                                                            |

## Implemented residual

The only genuine in-scope residual was bounded Antigravity manifest fetching.

`packages/engine/src/subscription/antigravity-version.ts` now reads the manifest stream incrementally
and cancels/rejects once it exceeds 4,096 bytes. It does not first buffer an unbounded response. The
new exact-named `TestGetBytesEnforcesMaxSize` regression test verifies the production fetch path.

No router weight, management asset, safe-mode HTML, raw config, Home, plugin, or ledger code was
added.

## Verification

- Exact upstream packages: **8 packages passed, 24 tests accounted for**.
- Focused local suite: **5 files passed, 61 tests passed**.
- Full engine suite: **306 files passed, 2,171 tests passed**.
- Full engine TypeScript check: passed.
- Full engine formatting: passed across **693 files**.
- Touched-file Oxlint and `git diff --check`: passed.
- Full engine Oxlint currently has one unrelated shared-worktree failure in
  `packages/engine/src/provider/summary-policy-parity.test.ts`: a 64-line callback exceeds the
  50-line function limit. That file was not edited by this reconciliation.
