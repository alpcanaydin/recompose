# Feature-cycle skill tasks

> For agentic workers: use superpowers:subagent-driven-development to execute task by task. Every commit passes lefthook without bypass. Global constraints: never commit to `main`, no code comments, commit style `<type>: <imperative subject>` with at most 50 characters, and `pnpm exec openspec validate --all --strict --no-interactive` stays green after every task.

### Task 1: Solution-design template

**Files:**

- Modify: `openspec/schemas/recompose/templates/design.md`

**Interfaces:**

- Produces: the seventeen-section template every future solution design instantiates. Section ids come verbatim from the research record in the process memory, restated in the task brief.

- [x] **Step 1: Replace the scaffold template**

Write the seventeen sections in order, each with a one-line purpose comment in HTML form and a placeholder body. Mark the always-on sections and the when-applicable ones. The decisions section links an Architecture Decision Record (ADR) draft. The section order:

```text
header and change linkage, context, discovery inputs consumed,
goals and non-goals, constraints and invariants, design,
data model and contracts, error handling, file map, interfaces,
decisions with the ADR draft link,
test matrix (unit, integration, end-to-end, property, mutation),
task decomposition hooks, risks, migration and rollout,
open questions, end-to-end verification
```

Two fill rules matter. A test-matrix row says what the layer proves, or gives a reason for none. An empty open-questions section asserts completeness.

- [x] **Step 2: Verify**

Run: `pnpm exec openspec schema validate recompose --verbose`
Expected: exit 0.

- [x] **Step 3: Commit**

```bash
git add openspec/schemas/
git commit -m "docs: seventeen-section solution-design template"
```

### Task 2: Subagent roster

**Files:**

- Create: `.claude/agents/code-analyzer.md`, `.claude/agents/researcher.md`, `.claude/agents/tdd-implementer.md`, `.claude/agents/adversarial-reviewer.md`, `.claude/agents/design-critic.md`
- Modify: `.claude/agents/rules-reviewer.md`

**Interfaces:**

- Consumes: the convention block from `design.md` in this change directory.
- Produces: the subagent names the skill dispatches by: `code-analyzer`, `researcher`, `tdd-implementer`, `adversarial-reviewer`, `design-critic`, `rules-reviewer`.

- [x] **Step 1: Write the five new definitions**

Each frontmatter carries: `name`, a trigger-rule `description` that states when it fires, an explicit `model` pin, `skills:` preloads, `memory: project` for the two reviewers, and `isolation: worktree` for the implementer. A restricted role carries a `tools` list, and a full-tool role omits the key, as the shipped `tdd-implementer` does. Judges (`adversarial-reviewer`, `design-critic`, `rules-reviewer`) stay read-only. Bodies stay short: role, inputs, output contract, escalation rule. All prose passes Vale and cspell.

- [x] **Step 2: Upgrade rules-reviewer**

Add the same convention to the existing definition without changing its role text beyond what the convention needs.

- [x] **Step 3: Verify**

Run: `mise exec -- vale .claude/agents/ && pnpm exec cspell --no-progress .claude/agents/`
Expected: 0 errors from both.

- [x] **Step 4: Commit**

```bash
git add .claude/agents/
git commit -m "feat: feature-cycle subagent roster"
```

### Task 3: The feature-cycle skill

**Files:**

- Create: `.claude/skills/feature-cycle/SKILL.md`
- Create: `.claude/skills/feature-cycle/references/planning.md`, `references/implementation.md`, `references/verification.md`

**Interfaces:**

- Consumes: the subagent names from Task 2 and the template from Task 1.
- Produces: the `/feature-cycle` entry point `CLAUDE.md` references in Task 4.

- [x] **Step 1: Write the skill**

`SKILL.md` holds the entry contract and the tier rubric with recommend-then-confirm and the one-way ratchet. It states the change-hygiene rule: create the change and seed a real delta in one commit. It records the sync rule: fetch, rebase, gate suite, ledger hygiene. Three reference files carry the phase details:

- `planning.md`: five discovery arms with caps, the interactive brainstorm, and two approval gates that return approve, reject with notes, or park.
- `implementation.md`: contracts cluster first, disjoint ownership, staggered worktrees, the merge train, red-proof pairs, and explicit test-layer tasks.
- `verification.md`: the reviewer pair with a judge, the mutation pass, the commit chain, and the pull request line with the CodeRabbit protocol.

Subagent-count caps and model pins appear as tables. The skills tree is prose-gate exempt.

- [x] **Step 2: Verify structure**

Run: `pnpm exec openspec validate --all --strict --no-interactive`
Expected: exit 0 (no openspec artifacts changed, the gate stays green).

- [x] **Step 3: Commit**

```bash
git add .claude/skills/feature-cycle/
git commit -m "feat: feature-cycle process skill"
```

### Task 4: Route CLAUDE.md through the skill

**Files:**

- Modify: `CLAUDE.md` (the feature development section)

**Interfaces:**

- Consumes: the `/feature-cycle` entry point from Task 3.

- [x] **Step 1: Rewrite the feature development section**

Every feature starts with `/feature-cycle <description>`. Trivial work keeps its escape hatch. Superpowers stays referenced as the executor library the skill calls for implementation. No other section changes.

- [x] **Step 2: Verify**

Run: `mise exec -- vale CLAUDE.md && pnpm exec cspell --no-progress CLAUDE.md`
Expected: 0 errors from both.

- [x] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: route features through feature-cycle"
```

### Task 5: Process record

**Files:**

- Create: `docs/adr/0038-feature-cycle-process.md` (confirm the next free number first)
- Modify: `docs/adr/README.md`

**Interfaces:**

- Consumes: every decision from `design.md` in this change plus the execution learnings the task brief lists.

- [x] **Step 1: Write the record through the new-adr skill**

Cover: the skill as process definition, the subagent conventions, the template adoption, the change-hygiene policy with the archive-only `skipSpecs` finding, and the surgical Vale section for delta trees. Full prose, Vale and cspell clean.

- [x] **Step 2: Update the index**

Add the row to `docs/adr/README.md` in the existing format.

- [x] **Step 3: Verify and commit**

Run: `mise exec -- vale docs/adr/0038-feature-cycle-process.md && pnpm exec cspell --no-progress docs/adr/`
Expected: 0 errors.

```bash
git add docs/adr/
git commit -m "docs: adr for feature-cycle process"
```

### Task 6: Pull request

**Files:** none (process step).

- [ ] **Step 1: Final validation sweep**

Run: `pnpm exec openspec validate --all --strict --no-interactive && pnpm run lint:prose && pnpm run lint:spell`
Expected: all exit 0.

- [ ] **Step 2: Push and hand over**

Push the branch, then prepare the `gh pr create` command for the owner with a body that names the change directory, the new capability, and the ADR.
