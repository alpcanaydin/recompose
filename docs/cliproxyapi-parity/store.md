<!-- vale off -->

# Internal store parity audit

Scope: all 32 upstream `Test*` functions under `internal/store`, compared with Recompose local accounts, gateways, vault, subscription credentials, atomic JSON persistence, quarantine, migrations, watchers, and serialized read-modify-write custody. Redis, PostgreSQL, Home, plugin stores, and Git-specific remote repository behavior are excluded.

## Verification

- Upstream: `go test ./internal/store/...` passed.
- Recompose focused suite: 81/81 passed across account/gateway/vault stores, newer-schema handling, watchers, subscription custody, migrations, quarantine, and vault ordering.
- Accounting: 32/32 rows exactly once.

## Git repository selection and branch management

Recompose does not use a Git-backed token/config store. Its storage root and filenames are local application paths, so remote-default discovery, configured branches, clone/pull/reset, and branch races are not applicable.

|   # | Upstream test                                                                        | Status | Evidence / rationale                                                               |
| --: | ------------------------------------------------------------------------------------ | ------ | ---------------------------------------------------------------------------------- |
|   1 | `TestEnsureRepositoryUsesRemoteDefaultBranchWhenBranchNotConfigured`                 | N/A    | No Git repository or remote-default branch.                                        |
|   2 | `TestEnsureRepositoryUsesConfiguredBranchWhenExplicitlySet`                          | N/A    | No configurable storage branch.                                                    |
|   3 | `TestEnsureRepositoryReturnsErrorForMissingConfiguredBranch`                         | N/A    | No Git branch lookup.                                                              |
|   4 | `TestEnsureRepositoryReturnsErrorForMissingConfiguredBranchOnExistingRepositoryPull` | N/A    | No repository pull.                                                                |
|   5 | `TestEnsureRepositoryInitializesEmptyRemoteUsingConfiguredBranch`                    | N/A    | No remote repository initialization.                                               |
|   6 | `TestEnsureRepositoryExistingRepoSwitchesToConfiguredBranch`                         | N/A    | No branch switching.                                                               |
|   7 | `TestEnsureRepositoryExistingRepoSwitchesToConfiguredBranchCreatedAfterClone`        | N/A    | No clone/late-created branch.                                                      |
|   8 | `TestEnsureRepositoryResetsToRemoteDefaultWhenBranchUnset`                           | N/A    | No remote reset.                                                                   |
|   9 | `TestGitTokenStoreConcurrentInitializationDoesNotOverwriteCreatedBranch`             | N/A    | Git branch-creation race is absent; local vault updates are serialized separately. |
|  10 | `TestEnsureRepositoryFollowsRenamedRemoteDefaultBranchWhenAvailable`                 | N/A    | No remote branch metadata.                                                         |
|  11 | `TestEnsureRepositoryKeepsCurrentBranchWhenRemoteDefaultCannotBeResolved`            | N/A    | No current/remote branch selection.                                                |

## Watcher and deletion safety

|   # | Upstream test                                                      | Status  | Evidence / rationale                                                                                                               |
| --: | ------------------------------------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------- |
|  12 | `TestGitTokenStoreRefusesWatcherOriginatedAuthDeletion`            | Covered | Accounts/gateway watchers are read-only change observers; no watcher path can delete subscription credentials or vault entries.    |
|  13 | `TestGitTokenStoreWatcherRemovalNoOpsAfterExplicitDelete`          | Covered | Explicit account/subscription removal owns deletion; subsequent watcher events only refresh state and perform no storage mutation. |
|  14 | `TestGitTokenStoreRepeatedDeleteDoesNotOverwriteRemoteOnlyChanges` | N/A     | Remote-only Git changes and push reconciliation do not exist locally.                                                              |

## Git index, divergence, leases, and commit ordering

|   # | Upstream test                                                          | Status | Evidence / rationale                                                                                                                           |
| --: | ---------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
|  15 | `TestGitTokenStoreRejectsPathsOutsideRepositoryBeforeMutation`         | N/A    | Git repository path confinement is absent; local stores receive application-derived file paths rather than repository-relative mutation paths. |
|  16 | `TestGitTokenStorePersistConfigDropsUnrelatedStagedDeletions`          | N/A    | No Git index/staging area.                                                                                                                     |
|  17 | `TestGitTokenStorePersistConfigRepairsIndexAfterUnstagedPull`          | N/A    | No index or pull.                                                                                                                              |
|  18 | `TestGitTokenStorePersistConfigPreservesRemoteOnlyAuthAfterDivergence` | N/A    | No local/remote Git divergence.                                                                                                                |
|  19 | `TestGitTokenStoreRejectsStaleForcePush`                               | N/A    | No force push or lease.                                                                                                                        |
|  20 | `TestGitTokenStoreSaveRetryAfterLeaseConflictCommitsMatchingContent`   | N/A    | No push lease conflict/retry.                                                                                                                  |
|  21 | `TestEnsureRepositoryRetryRestoresTrackedAuthOnUpToDatePull`           | N/A    | No tracked Git auth tree or pull retry.                                                                                                        |
|  22 | `TestEnsureRepositoryReconcilesRemoteAuthChangesAroundLocalConfig`     | N/A    | No remote auth/config merge.                                                                                                                   |
|  23 | `TestEnsureRepositoryReconcilesRemoteConfigChangesAroundLocalAuth`     | N/A    | No remote auth/config merge.                                                                                                                   |
|  24 | `TestEnsureRepositoryFailsClosedOnSamePathConflict`                    | N/A    | Git same-path merge conflicts are absent; local optimistic conflict semantics are not modeled as Git merges.                                   |
|  25 | `TestCommitAndPushLockedPushesBeforeRunningGC`                         | N/A    | No Git commit, push, or garbage collection.                                                                                                    |

## Git corruption and remote recovery

Recompose quarantines corrupt local JSON/vault/gateway files under timestamped backup names and preserves newer-schema files, but it has no Git object database, packfiles, remote baseline, or recovered-directory installation. Those local guarantees are summarized below rather than claimed as Git packfile parity.

|   # | Upstream test                                                                | Status | Evidence / rationale                             |
| --: | ---------------------------------------------------------------------------- | ------ | ------------------------------------------------ |
|  26 | `TestInstallRecoveredGitDirectoryRetainsBackupWhenRestoreFails`              | N/A    | No recovered Git-directory installation.         |
|  27 | `TestGitTokenStoreCorruptionRecoveryUsesLatestRemoteAuthTree`                | N/A    | No remote auth tree.                             |
|  28 | `TestGitTokenStoreCorruptionRecoveryPreservesOnlyNonConflictingLocalChanges` | N/A    | No Git object recovery/three-way reconciliation. |
|  29 | `TestGitTokenStoreFullPackfileCorruptionFailsClosedWithDirtyManagedFile`     | N/A    | No packfiles or dirty Git managed-file state.    |
|  30 | `TestGitTokenStoreMissingPackfileRecoveryFailsClosedWithoutBaseline`         | N/A    | No packfiles or remote baseline.                 |

## PostgreSQL cooldown store

PostgreSQL is explicitly excluded; Recompose keeps provider retry/rate-limit state in process rather than a shared database.

|   # | Upstream test                                              | Status | Evidence / rationale                          |
| --: | ---------------------------------------------------------- | ------ | --------------------------------------------- |
|  31 | `TestPostgresCooldownStateStore_SaveLoad`                  | N/A    | No PostgreSQL cooldown store.                 |
|  32 | `TestPostgresCooldownStateStore_MergesConcurrentInstances` | N/A    | No cross-instance PostgreSQL merge semantics. |

## Summary

- Covered: 2
- Gap: 0
- N/A: 30

## Adjacent Recompose local-storage coverage

- `writeJsonAtomic` backs accounts, gateways, settings, and vault persistence with temporary-file replacement.
- Corrupt account, gateway, settings, and vault documents are quarantined; unsupported newer schemas are preserved and surfaced rather than quarantined.
- Account and gateway schema migrations are deterministic and property-tested across historical versions.
- Vault read-modify-write operations are serialized through `inVaultOrder`, preventing lost concurrent secret updates.
- Subscription credentials use provider-native custody with explicit read/write/remove tests.
- Accounts and gateway watchers are lifecycle-tested for debounce cancellation, errors, terminal closure, and read-only propagation.

## Grouped implementation seams

No in-scope gap remains. A shared multi-process local lock or database-backed cooldown store would be a new product architecture, not parity with Recompose's current single-desktop-process storage model.

Git, PostgreSQL, Redis, Home, and plugin store behaviors remain explicitly outside scope.
