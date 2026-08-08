<!-- vale off -->

# Final logging parity reconciliation

Scope: all 31 upstream `internal/logging` tests reconciled against Recompose structured provider observations, JSONL persistence/rotation, trace metadata, AI route classification, and request diagnostics.

## Final counts

- **Covered: 12**
- **N/A: 19**
- **Gaps: 0**

The N/A rows are the explicitly excluded Gin recovery, multipart body-source files, Home app-log forwarding, and plugin formatter contracts. All in-scope behavior now has exact local parity proof.

## Row-level reconciliation

|   # | Seam                 | Upstream test                                                                           | Status  | Local evidence                                                                                                                      |
| --: | -------------------- | --------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
|   1 | Rotation/cleanup     | `TestEnforceLogDirSizeLimitDeletesOldest`                                               | Covered | Exact-named test: `packages/engine/src/provider/logging-parity.test.ts:12`                                                          |
|   2 | Rotation/cleanup     | `TestEnforceLogDirSizeLimitSkipsProtected`                                              | Covered | Exact-named test: `packages/engine/src/provider/logging-parity.test.ts:28`                                                          |
|   3 | Request body/Home    | `TestFileBodySource_RecreatesPartDirAfterManualCleanup`                                 | N/A     | Multipart request-body source/part-directory lifecycle is excluded; local observations store structured request snapshots directly. |
|   4 | Request body/Home    | `TestFileRequestLogger_HomeEnabled_ForwardsWhenRequestLogEnabled`                       | N/A     | Home owner binding and app-log forwarding are excluded from the local architecture.                                                 |
|   5 | Request body/Home    | `TestFileRequestLogger_LogRequestWithSourcesWritesLocalLogAndCleansParts`               | N/A     | Multipart request-body source/part-directory lifecycle is excluded; local observations store structured request snapshots directly. |
|   6 | Request body/Home    | `TestFileRequestLogger_HomeEnabled_ForwardsSourceLogAndCleansParts`                     | N/A     | Multipart request-body source/part-directory lifecycle is excluded; local observations store structured request snapshots directly. |
|   7 | Request body/Home    | `TestFileRequestLogger_HomeEnabled_ForwardsStreamingRequestID`                          | N/A     | Home owner binding and app-log forwarding are excluded from the local architecture.                                                 |
|   8 | Request body/Home    | `TestFileRequestLogger_HomeEnabled_DoesNotForwardForcedErrorLogsWhenRequestLogDisabled` | N/A     | Home owner binding and app-log forwarding are excluded from the local architecture.                                                 |
|   9 | CPA trace            | `TestFormatCPATraceID`                                                                  | Covered | Exact-named test: `packages/engine/src/provider/logging-parity.test.ts:41`                                                          |
|  10 | CPA trace            | `TestCPATraceIDMiddlewareRequiresAuthIndexBeforeResponseCommit`                         | Covered | Exact-named test: `packages/engine/src/provider/logging-parity.test.ts:49`                                                          |
|  11 | CPA trace            | `TestCPATraceIDConcurrentSelectionAndResponseCommit`                                    | Covered | Exact-named test: `packages/engine/src/provider/logging-parity.test.ts:65`                                                          |
|  12 | Formatter fields     | `TestLogFormatterPrintsVersionField`                                                    | Covered | Exact-named test: `packages/engine/src/provider/logging-parity.test.ts:84`                                                          |
|  13 | Formatter fields     | `TestLogFormatterPrintsMediaForwardingFields`                                           | Covered | Exact-named test: `packages/engine/src/provider/logging-parity.test.ts:88`                                                          |
|  14 | Formatter fields     | `TestLogFormatterPrintsPluginFields`                                                    | N/A     | Plugin formatter fields are explicitly excluded.                                                                                    |
|  15 | Formatter fields     | `TestLogFormatterOmitsGenericPathField`                                                 | Covered | Exact-named test: `packages/engine/src/provider/logging-parity.test.ts:109`                                                         |
|  16 | Home app forwarding  | `TestHomeAppLogForwarder_ForwardsFormattedLogWhenBoundOwnerIsHealthy`                   | N/A     | Home owner binding and app-log forwarding are excluded from the local architecture.                                                 |
|  17 | Home app forwarding  | `TestHomeAppLogForwarder_StopUnregistersMuxTarget`                                      | N/A     | Home owner binding and app-log forwarding are excluded from the local architecture.                                                 |
|  18 | Home app forwarding  | `TestHomeAppLogForwardersUseOneProcessWideMuxHook`                                      | N/A     | Home owner binding and app-log forwarding are excluded from the local architecture.                                                 |
|  19 | Home app forwarding  | `TestHomeAppLogForwarder_RebindsOnlyToCurrentOwner`                                     | N/A     | Home owner binding and app-log forwarding are excluded from the local architecture.                                                 |
|  20 | Home app forwarding  | `TestHomeAppLogForwarder_DelayedOldOwnerUnsupportedDoesNotDisableNewOwner`              | N/A     | Home owner binding and app-log forwarding are excluded from the local architecture.                                                 |
|  21 | Home app forwarding  | `TestHomeAppLogForwarder_UnboundNeverUsesGlobalFallbackClient`                          | N/A     | Home owner binding and app-log forwarding are excluded from the local architecture.                                                 |
|  22 | Home app forwarding  | `TestHomeAppLogForwarder_DropsPreACKAndReconnectGapLogs`                                | N/A     | Home owner binding and app-log forwarding are excluded from the local architecture.                                                 |
|  23 | Home app forwarding  | `TestHomeAppLogForwarder_OmitsPlaceholderRequestID`                                     | N/A     | Home owner binding and app-log forwarding are excluded from the local architecture.                                                 |
|  24 | Home app forwarding  | `TestHomeAppLogForwarder_SkipsWhenBoundOwnerHeartbeatIsDown`                            | N/A     | Home owner binding and app-log forwarding are excluded from the local architecture.                                                 |
|  25 | Home app forwarding  | `TestHomeAppLogForwarder_DisablesForwardingWhenBoundOwnerDoesNotSupportAppLog`          | N/A     | Home owner binding and app-log forwarding are excluded from the local architecture.                                                 |
|  26 | HTTP middleware/path | `TestGinLogrusRecoveryRepanicsErrAbortHandler`                                          | N/A     | Gin recovery middleware is framework-specific and explicitly excluded; Recompose uses Hono/Node.                                    |
|  27 | HTTP middleware/path | `TestGinLogrusRecoveryHandlesRegularPanic`                                              | N/A     | Gin recovery middleware is framework-specific and explicitly excluded; Recompose uses Hono/Node.                                    |
|  28 | HTTP middleware/path | `TestIsAIAPIPathIncludesPublicAPIGroups`                                                | Covered | Exact-named test: `packages/engine/src/provider/logging-parity.test.ts:117`                                                         |
|  29 | HTTP middleware/path | `TestIsAIAPIPathIncludesImages`                                                         | Covered | Exact-named test: `packages/engine/src/provider/logging-parity.test.ts:124`                                                         |
|  30 | HTTP middleware/path | `TestIsAIAPIPathIncludesCodexBackend`                                                   | Covered | Exact-named test: `packages/engine/src/provider/logging-parity.test.ts:129`                                                         |
|  31 | HTTP middleware/path | `TestGinLogrusLoggerAddsRequestIDForCodexBackend`                                       | Covered | Exact-named test: `packages/engine/src/provider/logging-parity.test.ts:134`                                                         |

## Implemented in-scope logging behavior

- Protected-path-aware oldest-first log directory cleanup.
- CPA trace ID formatting and commit-safe selection state.
- Allowlisted provider version and media-forwarding fields without credentials, request bodies, sensitive headers, or generic paths.
- Public AI API, image/video, and Codex backend path classification.
- Codex backend request-ID creation and stable reuse.

## Verification

- Final observability suite: **8 files passed, 42 tests passed**.
- Full engine TypeScript check passed.
- Full engine Oxlint passed.
- Formatting and `git diff --check` passed.
- All touched files satisfy complexity ≤5, function length ≤50, and file length ≤300.

No Gin, multipart body-file, Home forwarding, plugin formatter, CLI logger, router, or ledger changes were included.
