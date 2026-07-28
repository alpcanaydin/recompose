# Planning phase

Planning runs five parallel discovery arms, one interactive brainstorm, and two approval gates. The `full` tier runs every step. The `standard` tier trims as noted. The `trivial` tier never reaches this file: the session does the work directly and the pull request still faces every machine gate.

## Step 1: Classify

A Haiku classifier fills `isUI` and the affected subsystems, then recommends a tier with its rubric reasons. The maintainer confirms or overrides in one word. Write the confirmed tier into `manifest.md` frontmatter. That value governs the shape of every step below.

## Step 2: Discover

The `feature-kickoff` saved workflow, at `.claude/workflows/feature-kickoff.js`, runs by name and takes the change slug and the confirmed tier as `{ slug, tier }`. It dispatches the discovery arms in parallel, and an assertion throws before dispatch if the folded arm table exceeds six subagents: that assertion is the machine enforcement, so the operator no longer counts. Each arm writes its own file into `openspec/changes/<slug>/discovery/`.

| Arm                      | Subagent                    | Runs when     | Produces                                          |
| ------------------------ | --------------------------- | ------------- | ------------------------------------------------- |
| technical research       | `researcher`                | always        | a cited brief on libraries, standards, prior art  |
| codebase readers         | `code-analyzer`             | always        | a code map of paths, symbols, and FSD layers      |
| Mobbin references        | the session                 | `isUI` only   | screens and flows for the design-system reference |
| acceptance references    | `researcher`                | always        | criteria from vendor docs, issue trackers, and community complaints |
| rider-ledger lookup      | `code-analyzer`             | always        | prior out-of-scope riders read from the issue tracker, cited by issue number |

Acceptance references come from vendor docs, issue trackers, and community complaints, because broken expectations reveal the hidden criteria the happy-path docs omit. Machine-written output lands in `discovery/`, which the prose gates exempt.

The workflow validates the code map with the zero-token citation validator at `.claude/workflows/citation-validator/citation-validator.mts`. It rejects a cited path that does not resolve inside the repository or does not exist, and a cited symbol its own file does not hold. On rejection, the `code-analyzer` arm reruns once with the failing citations as input. A second failing verdict throws, naming every failing citation.

The Mobbin arm runs in the orchestrating session, not in a subagent, so the workflow does not carry it. The Mobbin Model Context Protocol tools live in the session, and `researcher`'s tool pins (`WebSearch`, `WebFetch`, `Read`) exclude them. Session-run work does not consume a slot in the six-subagent cap.

The brainstorm in step 3 stays in the session too: the workflow stops at the brainstorm.

**Standard tier:** technical research and acceptance references fold into a single `researcher` brief. `code-analyzer` maps the code. The session runs the Mobbin pass when the feature touches UI. The rider-ledger lookup runs on the `full` tier only: `researcher`'s tool pins (`WebSearch`, `WebFetch`, `Read`) carry no command access, so a `standard`-tier feature closes without a tracker check for prior out-of-scope findings.

## Step 3: Brainstorm

Interactive, with the maintainer. On the `full` tier a Fable 5 panel writes three candidate approaches with scores. Those arrive as input to the table, not as a decision. The maintainer and the session lock the decisions together, borrowing the `superpowers:brainstorming` question discipline. The locked decisions land in `openspec/changes/<slug>/`.

**Standard tier:** skip the candidate panel. Move the discovery findings straight into the brainstorm.

## Step 4: Design document (Approval gate 1)

A single writer amends `proposal.md` in the change directory with the brainstorm's locked decisions and a design-system gap analysis, alongside a Claude Design sync. That revision of `proposal.md` is the gate-1 design document, so a fresh session reads it from the change directory rather than from a separate schema artifact. It is born Vale-compliant, because it is a human-approved document, not machine discovery output.

On features that touch UI, a `design-critic` makes one read-only critique pass over that revision before the maintainer sees gate 1. Its findings enter the gate as input, never as a blocker on their own.

**Approval gate 1.** The maintainer returns one of three verdicts on that revision:

- **approve**: the design document freezes and the next step opens.
- **reject with notes**: regenerate only the design document. Approved siblings stay frozen.
- **park**: stop and hold. Nothing downstream opens.

Record the transition in `manifest.md` only at this gate.

## Step 5: Gherkin and solution design (Approval gate 2)

Both consume the approved design document and run in parallel on the `full` tier.

- **Gherkin.** A Fable 5 writer produces the scenarios through the `gherkin-best-practices` skill, with the collected acceptance references as input. OpenSpec stores the result under `gherkin/`; it does not generate the scenarios itself, because generated scenarios sit below the project's bar. Approved scenarios later graduate into `apps/desktop/e2e/features/`.
- **Solution design.** A Fable 5 writer instantiates the seventeen-section solution-design template that `openspec new change` scaffolds for the `design` artifact (`openspec/schemas/recompose/templates/design.md`). It fills the five-layer test matrix (unit, integration, end-to-end, property, and mutation scope) and drafts an ADR. It consumes the discovery outputs: the code map, the research findings, and the rider hits.

The template split, restated at dispatch:

- **Always-on** sections stay filled on every tier: Header and change linkage, Context, Discovery inputs consumed, Goals and non-goals, Constraints and invariants, Design, File map, Interfaces, Decisions, Test matrix, Task decomposition hooks, Risks, Open questions, and End-to-end verification.
- **When-applicable** sections may collapse to `None` on the `standard` tier: Data model and contracts, Error handling, and Migration and rollout.

**Standard tier:** a single subagent writes both the design document and the solution design. Both approval gates stay unchanged.

**Approval gate 2.** The maintainer returns approve, reject with notes, or park, with the same meaning as gate 1. On approve, **the scenario set freezes here.** Any later change to a scenario goes through a spec amendment and a fresh approval, never an in-place edit. Record the transition in `manifest.md`.

Approval unlocks [implementation.md](implementation.md).
