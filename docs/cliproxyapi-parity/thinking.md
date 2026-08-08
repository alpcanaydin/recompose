<!-- vale off -->

# Internal thinking final reconciliation

## Scope and result

- Upstream: `router-for-me/CLIProxyAPI` commit `8392b180ce3789eba9fd06ebc812b4fc237876e1`.
- Corpus: every top-level `Test*` under `internal/thinking`.
- Inventory: **24** rows.
- Final result: **24 covered**, **0 N/A**, **0 gaps**.
- Excluded: plugins, routers, and ledger work.

## Complete row map

|   # | Upstream test                                                                     | Status  | Recompose evidence                                                                                                                                                   |
| --: | --------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   1 | TestApplyThinkingWithModelInfoMapsCrossFamilyHighIntent                           | covered | Exact capability test maps `xhigh/max/high` to the closest supported high intent.                                                                                    |
|   2 | TestApplyThinkingWithModelInfoMapsOpenAICompatibilityHighIntent                   | covered | Explicit non-strict compatibility mapping preserves wire format while clamping to target levels.                                                                     |
|   3 | TestApplyThinkingWithModelInfoMapsResponsesToCodexHighIntent                      | covered | Original Responses `max` maps to Codex-supported `xhigh`.                                                                                                            |
|   4 | TestApplyThinkingWithModelInfoKeepsSameFamilyValidationStrict                     | covered | Strict same-family capability mode rejects unsupported levels.                                                                                                       |
|   5 | TestApplyThinkingWithModelInfoAppliesEnabledSummaryOnlyClaudeVisibility           | covered | Responses summary-only intent activates valid Claude thinking and summarized display.                                                                                |
|   6 | TestApplyThinkingWithModelInfoAndSummaryDropsInferredClaudeModeWhenSummaryRemoved | covered | Summary policy tracks inferred Claude thinking and removes only the inferred block when policy becomes unspecified.                                                  |
|   7 | TestApplyThinkingWithModelInfoDoesNotActivateClaudeForDisabledSummary             | covered | Disabled/null summary never activates Claude thinking.                                                                                                               |
|   8 | TestApplyThinkingWithModelInfoSummaryOnlyDoesNotInventOpenAIEffort                | covered | Chat output emits no effort when the source carries summary only.                                                                                                    |
|   9 | TestApplyThinkingWithSummaryKeepsOpenAIChatSuffixNone                             | covered | General suffix parser strips `(none)` and writes `reasoning_effort=none`.                                                                                            |
|  10 | TestApplyThinkingWithModelInfoUsesOpenRouterVisibility                            | covered | OpenRouter summary-only intent writes `reasoning.exclude=false` without inventing effort.                                                                            |
|  11 | TestApplyThinkingWithModelInfoUsesOriginalResponsesEffort                         | covered | Source Responses effort overrides translated defaults before capability mapping.                                                                                     |
|  12 | TestKimiClaudeMessagesMaxClampsToHigh                                             | covered | Kimi reuses the capability mapper; `(max)` and `(xhigh)` clamp to `high`.                                                                                            |
|  13 | TestExtractSummaryConfig                                                          | covered | Unified extraction handles Chat precedence, Responses detail/null/deprecated fields, active Claude display, Gemini/Antigravity booleans, and Interactions selectors. |
|  14 | TestExtractExplicitSummaryConfigDoesNotUseChatEffort                              | covered | Explicit Chat extraction ignores effort inference while retaining explicit exclusion controls.                                                                       |
|  15 | TestApplySummaryConfig                                                            | covered | Provider-neutral enabled/disabled/unspecified policy writes canonical Chat, Claude, Gemini, Antigravity, Interactions, and Responses fields.                         |
|  16 | TestApplySummaryConfig_OpenAIChatProviderDialects                                 | covered | Native OpenAI invents no visibility; OpenRouter uses `reasoning.exclude`; documented efforts remain untouched for Kimi/DeepSeek-style providers.                     |
|  17 | TestApplySummaryConfigNormalizesTargetAliases                                     | covered | Gemini/Antigravity snake aliases and Interactions camel alias normalize to canonical target fields.                                                                  |
|  18 | TestApplySummaryConfig_ClaudeDisplayRequiresActiveThinking                        | covered | Disabled summaries leave inactive/disabled Claude bodies unchanged; display is written only on active or policy-inferred thinking.                                   |
|  19 | TestApplySummaryConfigForModel_ClaudeEnabledSummaryUsesValidThinkingMode          | covered | Claude 5 adaptive models use `adaptive`; manual models use `enabled` with a 1024-token minimum budget.                                                               |
|  20 | TestApplySummaryConfigForModel_ClaudeDisabledSummaryDoesNotEnableThinking         | covered | Disabled summary preserves the per-model default and adds no thinking block.                                                                                         |
|  21 | TestApplySummaryConfig_ResponsesNormalizesDeprecatedGenerateSummary               | covered | `reasoning.generate_summary` becomes canonical `reasoning.summary`.                                                                                                  |
|  22 | TestApplySummaryConfig_ResponsesDisabledOmitsSummary                              | covered | Disabling removes summary while preserving effort.                                                                                                                   |
|  23 | TestApplySummaryConfig_ResponsesDisabledDropsEmptyReasoning                       | covered | Empty reasoning object is removed after summary deletion.                                                                                                            |
|  24 | TestApplySummaryConfig_UnspecifiedLeavesBodyUnchanged                             | covered | Unspecified policy returns the caller body unchanged unless removing a previously policy-inferred Claude block.                                                      |

## Implementation summary

- `reasoning-capabilities.ts`: general suffix parsing, strict/cross-family level mapping, dynamic/zero behavior, and budget limits.
- `summary-policy-extract.ts`: explicit and inferred summary extraction with protocol precedence.
- `summary-policy-apply.ts`: format-specific canonical application and Claude inferred-mode lifecycle.
- `gateway-outbound-body.ts`: applies source summary intent after translation and normalizes same-dialect Responses fields.
- `kimi-request.ts`: uses the shared capability level mapper.

## Verification

- Exact upstream: `go test ./internal/thinking` — all 24 tests passed.
- Direct parity: six capability rows, twelve summary rows, and supplemental dynamic/zero/budget cases passed.
- Full engine and global gate status is reported in the accompanying handoff.
