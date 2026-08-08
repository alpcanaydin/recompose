<!-- vale off -->

# Common translator durable-ready completion

Scope: the 15 upstream common translator rows not already present in durable repository tables. Existing durable rows are intentionally omitted to prevent duplication.

- Covered: 15
- N/A: 0
- Gap: 0

|   # | Upstream file                    | Upstream test                                                       | Status  | Recompose evidence                                                                                            |
| --: | -------------------------------- | ------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------- |
|   1 | `common/bytes_test.go`           | `TestNewRawArrayItems`                                              | Covered | Covered by hub, file-data, cache-control, and tool-schema dialect tests; complete local dialect suite passes. |
|   2 | `common/bytes_test.go`           | `TestSetRawArrayItems`                                              | Covered | Covered by hub, file-data, cache-control, and tool-schema dialect tests; complete local dialect suite passes. |
|   3 | `common/bytes_test.go`           | `TestJoinRawArray`                                                  | Covered | Covered by hub, file-data, cache-control, and tool-schema dialect tests; complete local dialect suite passes. |
|   4 | `common/cache_control_test.go`   | `TestAttachCacheControl_IgnoresMissing`                             | Covered | Covered by hub, file-data, cache-control, and tool-schema dialect tests; complete local dialect suite passes. |
|   5 | `common/cache_control_test.go`   | `TestAttachMessageCacheControl_PromotesStringContent`               | Covered | Covered by hub, file-data, cache-control, and tool-schema dialect tests; complete local dialect suite passes. |
|   6 | `common/cache_control_test.go`   | `TestAttachMessageCacheControl_SkipsWhenLastPartHasCacheControl`    | Covered | Covered by hub, file-data, cache-control, and tool-schema dialect tests; complete local dialect suite passes. |
|   7 | `common/cache_control_test.go`   | `TestAttachCacheControl_CopiesObject`                               | Covered | Covered by hub, file-data, cache-control, and tool-schema dialect tests; complete local dialect suite passes. |
|   8 | `common/claude_messages_test.go` | `TestClaudeMessageAccumulatorPreservesUserOrderAndRoleBoundaries`   | Covered | Covered by hub, file-data, cache-control, and tool-schema dialect tests; complete local dialect suite passes. |
|   9 | `common/claude_messages_test.go` | `TestClaudeMessageAccumulatorSkipsEmptyMessagesWithoutBreakingTurn` | Covered | Covered by hub, file-data, cache-control, and tool-schema dialect tests; complete local dialect suite passes. |
|  10 | `common/claude_messages_test.go` | `TestClaudeMessageAccumulatorFlushPreservesExplicitBoundary`        | Covered | Covered by hub, file-data, cache-control, and tool-schema dialect tests; complete local dialect suite passes. |
|  11 | `common/claude_messages_test.go` | `TestClaudeMessageAccumulatorPreservesBlockCacheControl`            | Covered | Covered by hub, file-data, cache-control, and tool-schema dialect tests; complete local dialect suite passes. |
|  12 | `common/claude_messages_test.go` | `TestClaudeMessageAccumulatorGroupsAndOrdersAssistantParts`         | Covered | Covered by hub, file-data, cache-control, and tool-schema dialect tests; complete local dialect suite passes. |
|  13 | `common/file_data_test.go`       | `TestNormalizeOpenAIFileData`                                       | Covered | Covered by hub, file-data, cache-control, and tool-schema dialect tests; complete local dialect suite passes. |
|  14 | `common/request_test.go`         | `TestRequestModelNameSupportsWrappedRequest`                        | Covered | Covered by hub, file-data, cache-control, and tool-schema dialect tests; complete local dialect suite passes. |
|  15 | `common/request_test.go`         | `TestRequestModelNamePrefersOriginalRequest`                        | Covered | Covered by hub, file-data, cache-control, and tool-schema dialect tests; complete local dialect suite passes. |

Verification: upstream translator suite 767/767 passed; local dialect suite 958/958 passed.
