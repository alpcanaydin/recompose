# Discovery-ledger proposal

## Why

The verification phase says an out-of-scope discovery lands in a ledger, which keeps the fix cycle scoped without losing what it found. No ledger exists, so such a discovery either widens the change in hand or disappears.

The gap already reaches shipped code. The `feature-kickoff` workflow dispatches an arm for prior out-of-scope findings that touch the feature. That arm has nothing to read, and it runs on a codebase reader, so it searches the source tree for something that was never in the repository.

## What changes

- The ledger becomes issues on the repository under one label. The tracker already carries this project's open work, so the ledger needs no new store, and a session files a discovery with one command.
- The `feature-kickoff` workflow's ledger arm queries the tracker rather than the source tree. That arm belongs to the `full` tier alone, because the `standard` tier's single research subagent carries no command access, and the planning reference states that loss.
- The planning and verification references gain the mechanism, and the skill's rollout note drops the ledger from its deferred list.

## Capabilities

### New capabilities

None.

### Modified capabilities

- `development-process`: an out-of-scope discovery lands in a labelled issue that a later feature's discovery phase reads.

## Impact

- A discovery that falls outside the change in hand gets an outlet, so a round keeps its scope without losing the finding.
- The discovery arm reports real prior findings rather than an empty search.
- The finding-by-commit verifier stays deferred. Building it before a feature has run through the pipeline would design it against imagination rather than experience.
