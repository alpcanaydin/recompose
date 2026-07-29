## Rider-ledger lookup for `settings-screen` (tier full): ledger is empty, and the lookup succeeded

**Result: zero riders. This is an empty ledger, not a lookup failure.** The distinction matters because the caller was told to treat a failed command differently from an empty result, so here is the evidence for each half of that claim.

### The lookup ran clean

The contract command returned an empty array with a zero exit status:

```
gh issue list --repo recomposesh/recompose --label rider --state open --limit 200 --json number,title,body
[]
EXIT=0
```

Three cross-checks confirm the empty result is real rather than a mislabeled or misrouted query:

1. **The label exists and is spelled as the contract says.** `gh api repos/recomposesh/recompose/labels/rider` returns `{"description":"Out-of-scope discovery parked from a fix cycle; read by the discovery phase","name":"rider"}`. A wrong label name would have produced a `404`, not `[]`.
2. **The repository slug is right.** `gh repo view recomposesh/recompose --json nameWithOwner,isPrivate` returns `{"isPrivate":false,"nameWithOwner":"recomposesh/recompose"}`.
3. **No issue has ever carried the label, in any state.** `gh issue list --label rider --state all` returns `[]` (exit 0), `gh search issues --repo recomposesh/recompose --label rider` returns `[]`, `gh api "search/issues?q=repo:recomposesh/recompose+label:rider" --jq '.total_count'` returns `0`, and `gh pr list --label rider --state all` returns `[]`, which rules out a rider parked on a pull request instead of an issue.

### The query matches the ledger contract

The shape I queried is the shape the repository defines, so an entry would have been visible had one existed:

- `openspec/specs/development-process/spec.md` line 86: a discovery outside the change in hand "MUST land in the repository's issue tracker, as an open issue carrying the `rider` label," with the body naming where it surfaced and why it fell outside scope, "because a later reader judges relevance from that text."
- `openspec/specs/development-process/spec.md` line 36 names the `rider-ledger` lookup as one of the five discovery lines on the full tier.
- `.claude/skills/feature-cycle/references/verification.md` line 48: "The `full` tier's discovery phase reads that ledger through its `rider-ledger` arm. Nothing gates the filing, because a gate over it would reward noticing nothing."
- `openspec/changes/archive/2026-07-28-discovery-ledger/design.md` line 59: "The reading arm requests the issue number, the title, and the body," which is exactly the `--json number,title,body` projection I used.

### Why the ledger is empty

The ledger machinery is three days old and no fix cycle has filed into it yet. The change that created it is archived at `openspec/changes/archive/2026-07-28-discovery-ledger/`, landing through commit `4abb703` ("fix: give the discovery ledger a home and a reader (#87)") and archived by `ad972f9` ("docs: archive the discovery-ledger change (#88)"). `settings-screen` is therefore the first feature to read a ledger that has never been written to.

### Gap reported rather than filled

The rider line contributes nothing to the `settings-screen` brainstorm. There is no prior out-of-scope discovery to fold into the settings route, the shared component layer, the schema version 2 migration, the token-minting channel, or the tray and login-item integrations named in `openspec/changes/settings-screen/proposal.md`. The other four discovery arms carry the phase alone.

**Outside the contract, stated so the caller does not mistake it for a rider.** The repository has nine open issues, and `gh issue list --state open --limit 50 --json number,title,labels` shows every one of them with an empty `labels` array: `#76`, `#47`, `#46`, `#45`, `#44`, `#43`, `#39`, `#33`, `#7`. None carries the `rider` label, so none qualifies as a ledger entry under the spec, and I am not judging their relevance to the feature. I flag only that `#76` ("Engine: user-facing lifecycle hooks on canvas nodes") sits adjacent to the proposal's note that reduced wire motion "waits on the canvas, which renders a placeholder today," should the caller want a separate, explicitly non-rider look at it.

No code map is included: this dispatch was the rider-ledger arm, and inventing a subsystem inventory here would put unsourced paths in front of the citation validator.
