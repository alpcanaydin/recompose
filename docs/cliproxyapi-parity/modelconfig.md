<!-- vale off -->

# Internal modelconfig final audit

## Scope and result

- Upstream: `router-for-me/CLIProxyAPI` commit `8392b180ce3789eba9fd06ebc812b4fc237876e1`.
- Corpus: all four top-level `Test*` functions under `internal/modelconfig`.
- Final result: **4 covered**, **0 N/A**, **0 gaps**.
- No plugin, router, or ledger changes.

|   # | Upstream test                                          | Status  | Direct Recompose evidence                                                                                                                                                                                                                                         |
| --: | ------------------------------------------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   1 | TestResolveModelInfoUsesSuffixFreeStaticCapabilities   | covered | `resolveConfiguredModelMetadata` strips a valid reasoning suffix for static lookup, preserves the exact configured ID, inherits `CLAUDE_OPUS_4_6` thinking metadata, and returns `userDefined=false`. Exact-named test in `provider/model-config-parity.test.ts`. |
|   2 | TestResolveModelInfoExplicitThinkingOverridesAndClones | covered | Explicit thinking metadata overrides static values; levels are trimmed, lowercased, deduplicated in source order, and cloned away from mutable input storage. Exact-named test.                                                                                   |
|   3 | TestNormalizeThinkingSupportDerivesSpecialLevelFlags   | covered | `normalizeModelThinking` retains normalized `none`/`auto` levels and derives `zeroAllowed`/`dynamicAllowed`. Exact-named test.                                                                                                                                    |
|   4 | TestResolveModelInfoUnknownModelKeepsMissingCapability | covered | Unknown configured models preserve their exact ID/provider with `thinking` absent and `userDefined=false`. Exact-named test.                                                                                                                                      |

## Implementation

- `provider/model-config.ts`: configured metadata resolution and thinking normalization.
- `provider/model-metadata.ts`: suffix-free static Claude Opus 4.6 metadata lookup, budget-capable thinking shape, and clone-safe snapshots.
- `provider/reasoning-capabilities.ts`: shared suffix-free model-name extraction.

## Verification

- Exact upstream: `go test ./internal/modelconfig` — 4 tests passed.
- Focused Recompose: model config, rich registry, and reasoning capabilities — 19 tests passed.
- Full gate status is reported in the accompanying handoff.
