<!-- vale off -->

# Interactions translator durable-ready completion

Scope: the 8 upstream interactions translator rows not already present in durable repository tables. Existing durable rows are intentionally omitted to prevent duplication.

- Covered: 8
- N/A: 0
- Gap: 0

|   # | Upstream file                                            | Upstream test                                                            | Status  | Recompose evidence                                                                      |
| --: | -------------------------------------------------------- | ------------------------------------------------------------------------ | ------- | --------------------------------------------------------------------------------------- |
|   1 | `interactions/claude/interactions_claude_compat_test.go` | `TestConvertClaudeRequestToInteractionsWithCompatPreservesEmptyThinking` | Covered | Covered by `interactions-claude-*parity.test.ts`; complete local dialect suite passes.  |
|   2 | `interactions/claude/interactions_claude_test.go`        | `TestConvertInteractionsResponseToClaudeStreamFinishMetadataUsage`       | Covered | Covered by `interactions-claude-*parity.test.ts`; complete local dialect suite passes.  |
|   3 | `interactions/claude/interactions_claude_test.go`        | `TestConvertClaudeRequestToInteractionsMapsMessagesToolsAndStream`       | Covered | Covered by `interactions-claude-*parity.test.ts`; complete local dialect suite passes.  |
|   4 | `interactions/claude/interactions_claude_test.go`        | `TestConvertInteractionsResponseToClaudeNonStream`                       | Covered | Covered by `interactions-claude-*parity.test.ts`; complete local dialect suite passes.  |
|   5 | `interactions/claude/interactions_claude_test.go`        | `TestConvertClaudeRequestToInteractionsMapsToolUseAndResult`             | Covered | Covered by `interactions-claude-*parity.test.ts`; complete local dialect suite passes.  |
|   6 | `interactions/claude/interactions_claude_test.go`        | `TestConvertInteractionsResponseToClaudeStream`                          | Covered | Covered by `interactions-claude-*parity.test.ts`; complete local dialect suite passes.  |
|   7 | `interactions/claude/interactions_claude_test.go`        | `TestConvertInteractionsResponseToClaudeStreamToolCall`                  | Covered | Covered by `interactions-claude-*parity.test.ts`; complete local dialect suite passes.  |
|   8 | `interactions/import_boundary_test.go`                   | `TestInteractionsTranslatorsDoNotImportGeminiTranslators`                | Covered | Covered by `interactions-import-boundary.test.ts`; complete local dialect suite passes. |

Verification: upstream translator suite 767/767 passed; local dialect suite 958/958 passed.
