---
name: feature-cycle
description: Invoke when a feature request enters the pipeline through `/feature-cycle <description>`, or whenever a "build this feature" ask needs to run from idea to merged pull request. Defines the classify, discover, design, implement, review, and pull-request process and the human gates between its runs.
---

# Feature cycle

The feature cycle turns a feature idea into a merged pull request through a graph of subagent nodes, deterministic code nodes, and human gates. This skill is the process definition. It orchestrates two supporting layers and owns everything between them.

- **OpenSpec** owns the artifact layer. `openspec new change <slug>` scaffolds `openspec/changes/<slug>/` with the recompose schema slots: proposal, specs, design, tasks, discovery, manifest, and gherkin. Merge archives the deltas into `openspec/specs/`.
- **Superpowers** is the execution library. Implementation delegates task-by-task execution to `superpowers:subagent-driven-development` and its resume ledger; planning borrows the brainstorming question discipline.
- **This skill** owns the graph, the tier rubric, the gate rules, the convergence rules, and the artifact contracts.

Human gates split the pipeline into separate runs that share no live state. Each run reads its inputs from the change directory and `manifest.md`, then writes its outputs back. The artifacts on disk are the edges between runs.

## Entry contract

Trigger: `/feature-cycle <description>`. On entry, before any phase work:

1. **Classify.** A Haiku classifier fills `isUI` and the affected subsystems, then recommends `trivial`, `standard`, or `full` with its rubric reasons.
2. **Confirm the tier.** The maintainer confirms or overrides in one word. This is recommend-then-confirm: the classifier proposes, the maintainer decides.
3. **Scaffold the change and seed a real delta in one commit.** See [Change hygiene](#change-hygiene).
4. **Run the phase set for the confirmed tier.** The reference files carry the detail: [planning.md](references/planning.md), [implementation.md](references/implementation.md), [verification.md](references/verification.md).

## Tier rubric

The recommendation follows a written rubric. The maintainer confirms it.

| Tier       | When it fits                                                      | Planning shape                                                                                                            |
| ---------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `trivial`  | single-file edit, config tweak, or docs, with no behavior change  | exit the pipeline and do the work directly; the pull request still faces every machine gate                               |
| `standard` | one subsystem, bounded behavior, no cross-cutting contract        | five discovery arms fold into one research pass, no candidate panel, a single subagent writes the design and the solution design; both approval gates stay |
| `full`     | cross-subsystem work, a new contract, or high blast radius        | five parallel discovery arms, the candidate-approach panel, and both approval gates                                       |

**One-way ratchet.** Mid-flight upgrades are allowed and silent downgrades are forbidden. An upgrade re-enters the richer planning shape for the parts not yet approved. A downgrade needs an explicit maintainer decision recorded at a gate, never an implicit slide. The confirmed tier lives in `manifest.md` frontmatter and is the single source of truth for which shape runs.

On the `standard` tier the solution-design template keeps every always-on section filled. Only the three when-applicable sections may collapse to `None`: Data model and contracts, Error handling, and Migration and rollout. [planning.md](references/planning.md) names this split at the solution-design step.

## Change hygiene

Scaffold with `openspec new change <slug>`. The recompose schema seeds the proposal, specs, design, tasks, discovery, manifest, and gherkin slots.

Never commit an empty scaffold. The first commit creates the change and carries a real spec delta in the same commit, so history never records a hollow directory that a later commit backfills.

## Sync rule

Before implementation opens, and again at the start of every fix round, run the sync step in order:

1. **Fetch** the latest `main`.
2. **Rebase** the worktree onto it.
3. **Gate suite.** Run the local gate suite and confirm green before any new work.
4. **Ledger hygiene.** Clean stale `superpowers:subagent-driven-development` resume-ledger entries.

A red rebase blocks work until a repair subagent clears it.

## Manifest discipline

`manifest.md` frontmatter carries `tier`, `phase`, `approvals`, and `branch`. Record phase transitions only at gates. Fine-grained per-checklist writes drift out of step with reality, so the gate is the only writer.

## Model map

Every subagent definition pins `model: opus` as its default. The rows below are the dispatch-time picture: the skill overrides seats at dispatch for judgment peaks and mechanical leaves.

| Work                                                                       | Model    | Effort note                                    |
| -------------------------------------------------------------------------- | -------- | ---------------------------------------------- |
| classification, triage, file inventory                                     | Haiku    | premium models buy only latency here           |
| research, semantic code reading, implementation, mechanical verification   | Opus 5   | code reading runs at low effort                |
| candidate approaches, design document, Gherkin, the hardest clusters       | Fable 5  | prompts state goals and constraints, not steps |
| the tiebreak judge on a review disagreement                                | Fable 5  | maximum effort                                 |

## Subagent caps

Every phase pins a hard subagent-count cap and a tool-call budget. The overrides column names where a seat leaves its `opus` default.

| Phase                    | Subagents                                                     | Cap                                                    | Dispatch-time override                          |
| ------------------------ | ------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------- |
| classify                 | the classifier                                                | 1                                                      | Haiku                                           |
| discovery (full)         | `code-analyzer`, `researcher` instances                       | six subagents total                                    | Opus 5; folds to one `researcher` on `standard` |
| candidate panel          | approach writers                                              | 3 approaches                                           | Fable 5; `full` tier only                       |
| design and solution      | one writer each (`standard` uses a single subagent for both)  | 1 per document                                         | Fable 5                                         |
| implementation           | `tdd-implementer`                                             | one per cluster, one worktree each; one task per invariant and per scenario | Opus 5; hardest clusters Fable 5                |
| adversarial review       | `adversarial-reviewer`                                        | 2 as a pair, plus 1 judge on disagreement              | one review seat and the judge to Fable 5        |
| mutation                 | none                                                          | deterministic Stryker run, no subagent                 | not applicable                                  |

The roster dispatched by name: `code-analyzer`, `researcher`, `tdd-implementer`, `adversarial-reviewer`, `design-critic`, `rules-reviewer`. Their definitions live under `.claude/agents/`.

## Phases

- [planning.md](references/planning.md): the five discovery arms with caps, the interactive brainstorm, and the two approval gates.
- [implementation.md](references/implementation.md): the contracts cluster, disjoint ownership, staggered worktrees, the merge train, red-proof pairs, and the explicit test-layer tasks. Task execution delegates to `superpowers:subagent-driven-development`.
- [verification.md](references/verification.md): the reviewer pair with a judge, the mutation pass, the commit chain, and the pull-request line with the CodeRabbit protocol.
