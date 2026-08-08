<!-- vale off -->

# Internal completion inventory audit v3

## Final result

The current repository durably reconciles every in-scope upstream row. The newly published
`docs/cliproxyapi-parity/runtime-executor.md` closes the final 299 temporary-only rows identified
by audit v2.

| Classification                        |      Rows |
| ------------------------------------- | --------: |
| Repository-durable row reconciliation |     2,536 |
| Approved top-level package exclusions |       390 |
| Temporary-only                        |         0 |
| Unaccounted                           |         0 |
| **Total**                             | **2,926** |

Final equation:

`2,536 durable + 390 approved exclusions + 0 temporary-only + 0 unaccounted = 2,926`.

There is **no remaining publication hole**.

## Authority

- Upstream: CLIProxyAPI v7.2.121.
- Pinned commit: `8392b180ce3789eba9fd06ebc812b4fc237876e1`.
- Audit date: August 8, 2026.
- Inventory command: `rg -n '^func Test' internal -g '*_test.go'`.
- Exact upstream inventory: **2,926 `Test*` functions**.
- Matching identity: upstream relative test file plus exact test function name.
- Matching is multiplicity-aware; repeated names in different packages are separate rows.

## Publication delta from audit v2

Audit v2 classified:

`2,237 durable + 299 temporary-only + 390 exclusions = 2,926`.

The runtime publication moves exactly 299 rows from temporary-only to durable:

| Previously temporary runtime family |    Rows |
| ----------------------------------- | ------: |
| xAI HTTP executor                   |      99 |
| Kimi executor                       |      28 |
| Executor helps package              |     172 |
| **Total newly durable**             | **299** |

Therefore `2,237 + 299 = 2,536` durable rows, with zero rows left temporary-only.

## Runtime publication validation

`docs/cliproxyapi-parity/runtime-executor.md` was compared directly with every upstream test under
`internal/runtime/executor`, using `relative-file::TestName` identity.

| Check                        | Result |
| ---------------------------- | -----: |
| Upstream runtime identities  |    870 |
| Published runtime identities |    870 |
| Unique upstream identities   |    870 |
| Unique published identities  |    870 |
| Missing identities           |      0 |
| Extra identities             |      0 |
| Duplicate mappings           |      0 |

Published runtime disposition:

| Status    |    Rows |
| --------- | ------: |
| Covered   |     755 |
| N/A       |     115 |
| Gap       |       0 |
| **Total** | **870** |

The runtime document's evidence-destination cells still reference several `/private/tmp` family
reports. Those references are provenance pointers, not temporary-only row mappings: all 870 exact
identities, statuses, and dispositions are now present in the durable repository document itself.

## Translator validation

The published translator completion and seven complementary family supplements remain exact:

| Check                                    | Result |
| ---------------------------------------- | -----: |
| Upstream translator identities           |    767 |
| Published complete translator identities |    767 |
| Missing identities                       |      0 |
| Extra identities                         |      0 |

The translator split remains 322 pre-existing durable rows plus 445 published complementary rows,
for **767/767 durable**.

## Remaining non-runtime, non-translator inventory

After removing runtime, translator, and approved top-level exclusions, **899** upstream rows remain.
Every one has an exact `Test*` occurrence in the existing durable family reports. No row from this
set is missing from repository documentation.

The full inventory partition is:

| Inventory partition               |      Rows |
| --------------------------------- | --------: |
| Runtime executor                  |       870 |
| Translator                        |       767 |
| Other durably reconciled packages |       899 |
| Approved top-level exclusions     |       390 |
| **Total**                         | **2,926** |

Thus `870 + 767 + 899 = 2,536` repository-durable rows.

## Multiplicity audit

There are 2,923 unique test names across 2,926 upstream rows. Exactly three names occur twice in
different upstream packages, and the durable reports contain both required rows:

| Test name                                         | Upstream occurrences | Durable occurrences | Durable report |
| ------------------------------------------------- | -------------------: | ------------------: | -------------- |
| `TestBuildResponse`                               |                    2 |                   2 | `client.md`    |
| `TestRefreshTokens_DeduplicatesConcurrentRefresh` |                    2 |                   2 | `auth.md`      |
| `TestRefreshTokens_UsesIndependentTimeout`        |                    2 |                   2 | `auth.md`      |

No exact upstream identity is consumed more than once. The runtime and translator complete tables
have no missing, extra, or duplicate identities, and the three legitimate repeated-name cases are
not collapsed.

## Approved exclusions

Only the six approved top-level package boundaries remain outside durable row reports:

| Package       |    Rows |
| ------------- | ------: |
| `pluginhost`  |     211 |
| `pluginstore` |      55 |
| `home`        |      81 |
| `homeplugins` |      21 |
| `redisqueue`  |      14 |
| `tui`         |       8 |
| **Total**     | **390** |

Nested Home, plugin, CLI/TUI, Redis, raw-config, transport, allocation, and Go-runtime-specific
rows inside otherwise in-scope families remain explicit durable N/A rows; they are not hidden in
this exclusion count.

## Closure

- Temporary-only reports may remain under `/private/tmp` as audit provenance, but no upstream row
  depends on them for durable classification.
- No row requires first-time reconciliation.
- No additional parity document must be published to close the 2,926-row inventory.
- Final status: **2,926/2,926 accounted exactly once; 0 temporary-only; 0 unaccounted**.
