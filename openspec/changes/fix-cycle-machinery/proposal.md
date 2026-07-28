# Fix-cycle-machinery proposal

## Why

The verification phase names two pieces of machinery that don't exist. Its rules say a finding closes only when its own verifier confirms the fix against the new commit. They also say an out-of-scope discovery lands in a ledger, which keeps the fix cycle scoped. Neither the verifier nor the ledger exists. A session decides both by hand today, and nothing records either.

The gap already reaches shipped code. The `feature-kickoff` workflow dispatches an arm to look up prior out-of-scope findings that touch the feature, and that arm has nothing to read. It also runs on a codebase reader, so it searches the source tree rather than the place such findings would live.

## What changes

- The ledger becomes issues on the repository, carrying one label. The tracker already holds this project's open work, so the ledger needs no new store, and a session files an out-of-scope discovery with one command.
- The `feature-kickoff` workflow's ledger arm queries the tracker rather than the source tree, so its brief reports real prior findings.
- A `fix-cycle` saved workflow runs one round: it repairs each open finding in turn, then dispatches a verifier per finding against the commit the repairs produced. A finding closes only on its own verifier's confirmation, keyed by finding and commit.
- The verification reference gains the concrete mechanism, and the skill's rollout note empties.
- A process Architecture Decision Record (ADR) records why the ledger lives in the tracker, why one round fits a workflow, and what the verifier proves.

## Capabilities

### New capabilities

None.

### Modified capabilities

- `development-process`: a finding closes on its verifier's confirmation against a named commit, and an out-of-scope discovery lands in a labelled issue that a later feature's discovery reads.

## Impact

- A fixed finding stops depending on assertion. The verifier names the commit it confirmed against.
- An out-of-scope discovery gets an outlet, so the fix cycle keeps its scope without losing the finding.
- The discovery arm reports real prior findings rather than an empty search.
- The workflow runs one round and stops, because the three-round cap ends in human triage and a workflow takes no input once it starts.
