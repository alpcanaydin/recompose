# OpenSpec Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adopt OpenSpec as the repo's artifact layer: install it, initialize the tree, add the recompose change schema, wire the prose gates, and gate validation — PR-1 of the feature-cycle rollout.

**Architecture:** OpenSpec (`@fission-ai/openspec`) owns `openspec/specs/` (living behavior contract) and `openspec/changes/<slug>/` (per-feature artifacts). A project schema named `recompose` extends the built-in spec-driven artifact graph with `discovery/`, `gherkin/`, and `manifest.md`. Machine-written discovery output is prose-gate exempt; human-approved documents stay fully linted. `openspec validate` becomes a gate per the standing rule (lefthook + CI step inside the required `check` job).

**Tech Stack:** OpenSpec v1.6+, pnpm, lefthook, Vale, cspell, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-07-26-feature-cycle-design.md` (sections: Layer architecture, Rollout item 1).

## Global Constraints

- Never commit to `main`; all work happens on this worktree branch, lands through a PR.
- New devDeps pinned exact: `pnpm add -DE`. Per ADR-0015 item 4, `minimumReleaseAgeExclude` lives in `pnpm-workspace.yaml`, not `renovate.json`, and only needs an entry when the installed version is younger than the configured `minimumReleaseAge` (4320 minutes / 3 days) at resolution time; a version already older than that window needs no entry.
- Standing gate rule: every gate gets a lefthook pre-commit job AND a CI step, and must be required — a step inside the `check` job is transitively required via `ci-success`.
- No code comments. No em dashes in authored markdown. All authored markdown passes Vale (Microsoft, full strength) and cspell; `docs/superpowers/plans/` and `.claude/skills/` are exempt.
- Every commit message through the caveman-commit style: `<type>: <imperative subject>` ≤50 chars.
- Vendored skills get recorded in `skills-lock.json` (see commit `fd1d311` for the shape).
- CI must be green on day one: tune so the empty OpenSpec tree validates cleanly.

---

### Task 1: Install OpenSpec

**Files:**

- Modify: `package.json` (root devDependencies + scripts later)
- Modify: `pnpm-workspace.yaml` (`minimumReleaseAgeExclude` array, only if the installed version is still inside the `minimumReleaseAge` window)
- Modify: `pnpm-lock.yaml` (generated)

**Interfaces:**

- Produces: `pnpm exec openspec` CLI available to every later task.

- [ ] **Step 1: Install pinned**

```bash
pnpm add -DE @fission-ai/openspec
```

- [ ] **Step 2: Verify the binary runs**

Run: `pnpm exec openspec --version`
Expected: a version string `1.6.x` or newer, exit 0.

- [ ] **Step 3: Apply the release-age convention**

Per ADR-0015 item 4, only packages whose installed version is younger than the `minimumReleaseAge` window (4320 minutes / 3 days in `pnpm-workspace.yaml`) need a `minimumReleaseAgeExclude` entry, added there in `"package@version"` format. Check the installed version's publish date; if it already clears the window, add nothing and note why. Otherwise open `pnpm-workspace.yaml` and append `'@fission-ai/openspec@<version>'` following the existing entries' format.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml pnpm-workspace.yaml
git commit -m "build: add openspec dependency"
```

(Include `pnpm-workspace.yaml` only if Step 3 added an exclusion entry.)

---

### Task 2: Initialize the OpenSpec tree

**Files:**

- Create: `openspec/config.yaml`, `openspec/specs/`, `openspec/changes/` (via CLI)
- Create: `.claude/skills/openspec-*` and `.claude/commands/opsx/*` (via CLI; v1.6.0 emits six skills and six commands)
- Modify: `.vale.ini` and `cspell.json` (exempt `.claude/commands/**`, the CLI-generated command files, same class as the already-exempt `.claude/skills/**`)
- Not modified: `skills-lock.json` (the generated skills are npm-generated and owned by the `@fission-ai/openspec` dependency, not github-vendored; the lock tracks github-vendored skills only, and the repo's own local skills are likewise absent from it)
- Not modified: `CLAUDE.md` / `AGENTS.md` (v1.6.0 init injects no pointer block)

**Interfaces:**

- Produces: the `openspec/` tree every later task edits; the `/opsx:*` workflows for future feature runs.

- [ ] **Step 1: Run init non-interactively for Claude tooling**

```bash
pnpm exec openspec init --tools claude
```

- [ ] **Step 2: Inspect everything init wrote**

Run: `git status --short`
Read every created or modified file. Expected: `openspec/` tree, skill files under `.claude/skills/`, possibly a pointer block in `CLAUDE.md`/`AGENTS.md`.

- [ ] **Step 3: Guard the linted files**

If init modified `CLAUDE.md` or created a root `AGENTS.md`, run:

```bash
mise exec -- vale CLAUDE.md AGENTS.md
```

If Vale reports errors in an injected block, rewrite the block to a single compliant sentence pointing at `openspec/AGENTS.md` (example: `OpenSpec workflow instructions live in openspec/AGENTS.md.`) and re-run Vale until 0 errors. Do not weaken `.vale.ini`.

- [ ] **Step 4: Verify validation passes on the empty tree**

Run: `pnpm exec openspec validate --all --no-interactive`
Expected: exit 0 (nothing to validate yet counts as success). If it exits 1 on an empty tree, record the exact message; the Task 5 gate script must use flags that make an empty tree pass (try without `--strict` first) and the ADR in Task 6 must note the chosen flags.

- [ ] **Step 5: Do not record the generated skills in the lock file**

Add nothing to `skills-lock.json`. The `.claude/skills/openspec-*` skills are generated by the pinned `@fission-ai/openspec` dependency and regenerated by `openspec update` — they are npm-owned, not github-vendored. `skills-lock.json` tracks github-vendored skills by content hash; the `playwright-best-practices` shape (`source`, `sourceType: github`, `computedHash`) does not apply, and the repo's own local skills (`gherkin-best-practices`, `new-adr`, `run-desktop`, `storybook-stories`) are likewise absent from the lock. Their provenance is the pinned dependency in `package.json` + `pnpm-lock.yaml`.

- [ ] **Step 6: Commit**

```bash
git add openspec/ .claude/commands/ .claude/skills/ .vale.ini cspell.json docs/superpowers/plans/2026-07-26-openspec-setup.md
git commit -m "build: initialize openspec tree"
```

(Stage only paths `git status --short` confirms exist; init touched neither `CLAUDE.md` nor `AGENTS.md`, and `skills-lock.json` stays untouched per the Step 5 decision.)

---

### Task 3: The recompose change schema

**Files:**

- Create: `openspec/schemas/recompose/schema.yaml` (via CLI, then edited)
- Create: `openspec/schemas/recompose/templates/*.md` (via CLI, plus three new templates)
- Modify: `.vale.ini` and `cspell.json` (exempt `openspec/schemas/**`; the CLI scaffold templates are machine-generated and fail Vale's Microsoft style, so this exemption is pulled forward from Task 4 to unblock this commit, same class as Task 2's `.claude/commands` exemption)

**Interfaces:**

- Consumes: the `openspec/` tree from Task 2.
- Produces: the default change schema every feature run instantiates; artifact ids `discovery`, `gherkin`, `manifest` that the feature-cycle skill (PR-2) references by name.

- [ ] **Step 1: Scaffold the schema as project default**

```bash
pnpm exec openspec schema init recompose --description "recompose feature-cycle change schema" --artifacts proposal,specs,design,tasks --default
```

- [ ] **Step 2: Add the three feature-cycle artifacts**

Open `openspec/schemas/recompose/schema.yaml`. Match the exact YAML shape the scaffold uses for the four standard artifacts (each entry has `id`, `generates`, `requires`, and possibly `template`). Append three entries following that same shape, with these values:

```yaml
- id: discovery
  generates: discovery/**/*.md
  requires: []
- id: manifest
  generates: manifest.md
  requires: []
- id: gherkin
  generates: gherkin/*.feature
  requires:
    - design
```

If the scaffolded entries carry extra keys (such as `template` or `description`), mirror those keys on the new entries too.

- [ ] **Step 3: Add templates for the new artifacts**

Create `openspec/schemas/recompose/templates/manifest.md`:

```markdown
---
tier:
phase: discovery
approvals: []
branch:
---
```

Create `openspec/schemas/recompose/templates/gherkin.md`:

```markdown
Scenario files live in this directory as `*.feature`, written through the gherkin-best-practices skill. Approved scenarios graduate into `apps/desktop/e2e/features/`.
```

Create `openspec/schemas/recompose/templates/discovery.md`:

```markdown
Machine-written discovery output lands here: code map, research brief, acceptance references, rider hits. Prose gates exempt this directory.
```

If `openspec schema validate` (next step) rejects templates for glob-based artifacts, delete the rejected template files and note the omission in the Task 6 ADR.

- [ ] **Step 4: Validate the schema**

Run: `pnpm exec openspec schema validate recompose --verbose`
Expected: exit 0. Fix any structural complaint it prints before moving on.

- [ ] **Step 5: Verify the default wiring**

Run: `pnpm exec openspec schema which recompose`
Expected: resolves to `openspec/schemas/recompose/`. Also confirm `openspec/config.yaml` now references the schema as default (the `--default` flag from Step 1); if it does not, add the reference using the key `openspec config` documents, and re-run this step.

- [ ] **Step 6: Exempt the machine-generated schema templates from the prose gates**

The CLI scaffold templates (`proposal.md`, `design.md`, `tasks.md`, `specs/spec.md`) are machine-generated and fail Vale's Microsoft style (heading capitalization, ellipsis, and the `WHEN`/`THEN`/`ADDED` acronyms), which blocks this commit. Pull the `openspec/schemas/**` exemption forward from Task 4 (same class as Task 2's `.claude/commands` exemption, machine-generated scaffolding). Human documents under `openspec/specs/**` and the `openspec/changes/` proposals and designs stay linted; only the schema scaffolding is exempt.

In `.vale.ini`, add `**/openspec/schemas/**` inside the brace-union exclusion section, comma-separated, next to `**/.claude/commands/**`.

In `cspell.json`, add `"openspec/schemas"` to `ignorePaths`.

Verify both gates pass over the whole tree:

```bash
pnpm run lint:prose
pnpm run lint:spell
```

Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add openspec/schemas/ openspec/config.yaml .vale.ini cspell.json
git commit -m "build: recompose change schema"
```

---

### Task 4: Prose-gate globs

**Files:**

- Modify: `.vale.ini` (the existing exclusion section)
- Modify: `cspell.json` (`ignorePaths`)

**Interfaces:**

- Consumes: the tree layout from Tasks 2-3.
- Produces: the gate policy the spec promises — discovery exempt, human documents linted.

- [ ] **Step 1: Extend the Vale exclusion glob**

Open `.vale.ini`. The second section header is a brace-union glob starting with `[{.claude/worktrees/**,`. Add one entry inside the braces, keeping the comma-separated single-line format (`**/openspec/schemas/**` already landed in Task 3):

```text
**/openspec/changes/**/discovery/**
```

Rationale to preserve: `openspec/specs/**`, `proposal.md`, and `design.md` stay linted on purpose; only machine output and scaffolding templates are exempt.

- [ ] **Step 2: Extend cspell ignorePaths**

Open `cspell.json` and add to `ignorePaths` (`"openspec/schemas"` already landed in Task 3):

```json
"openspec/changes/**/discovery"
```

- [ ] **Step 3: Run both prose gates over the whole tree**

Run: `pnpm run lint:prose`
Expected: exit 0.
Run: `pnpm run lint:spell`
Expected: exit 0. If OpenSpec's generated files (config, AGENTS pointer, skill files outside `.claude/skills/`) trip either gate, fix the file when it is human-facing, or add the narrowest possible glob when it is machine-generated, and record the choice for the Task 6 ADR.

- [ ] **Step 4: Commit**

```bash
git add .vale.ini cspell.json
git commit -m "ci: prose-gate globs for openspec tree"
```

---

### Task 5: Validation gate

**Files:**

- Modify: `package.json` (root `scripts`)
- Modify: `lefthook.yml` (pre-commit)
- Modify: `.github/workflows/ci.yml` (`check` job)

**Interfaces:**

- Consumes: the validate behavior confirmed in Task 2 Step 4.
- Produces: the `lint:openspec` script name that CI, lefthook, and future docs reference.

- [ ] **Step 1: Add the root script**

In root `package.json` scripts, next to `lint:prose`:

```json
"lint:openspec": "openspec validate --all --no-interactive"
```

Use `--strict` only if Task 2 Step 4 proved the empty tree passes with it.

- [ ] **Step 2: Verify the script**

Run: `pnpm run lint:openspec`
Expected: exit 0.

- [ ] **Step 3: Add the lefthook job**

In `lefthook.yml` pre-commit commands, following the existing priority-1 entries' format:

```yaml
- name: openspec
  priority: 1
  glob: 'openspec/**'
  run: pnpm run lint:openspec
```

- [ ] **Step 4: Add the CI step**

In `.github/workflows/ci.yml`, in the `check` job, add a step directly after the structural-lints step (the one running `lint:boundaries && lint:fsd && lint:dead`):

```yaml
- run: pnpm run lint:openspec
```

The `check` job is in `ci-success`'s needs list already, so the gate is transitively required; do not touch the ruleset.

Also add the same step to the `prose` job (after its lint steps), because `check` skips markdown-only pull requests and OpenSpec artifacts are mostly markdown — the two jobs together cover every path class:

```yaml
- run: pnpm run lint:openspec
```

- [ ] **Step 5: Verify lefthook end-to-end**

Run: `pnpm exec lefthook run pre-commit`
Expected: all jobs pass, including the new `openspec` job.

- [ ] **Step 6: Commit**

```bash
git add package.json lefthook.yml .github/workflows/ci.yml
git commit -m "ci: openspec validate gate"
```

---

### Task 6: Adoption ADR

**Files:**

- Create: `docs/adr/00XX-openspec-artifact-layer.md` (next free number at merge time; check `ls docs/adr/` first, expect 0037)
- Modify: `docs/adr/README.md` (index entry, following the existing rows)

**Interfaces:**

- Consumes: every judged deviation recorded by Tasks 2-5 (validate flags, template omissions, extra globs).
- Produces: the decision record the PR meta-gate requires for workflow/config changes.

- [ ] **Step 1: Write the ADR through the new-adr skill**

Invoke the `new-adr` skill. Content outline (write full prose, Vale-compliant, no em dashes):

- Context: feature-cycle spec section "Layer architecture"; the spec lives at `docs/superpowers/specs/2026-07-26-feature-cycle-design.md`.
- Decision: OpenSpec as artifact layer; the `recompose` schema with `discovery`/`gherkin`/`manifest` artifacts; prose-gate policy (discovery and schema templates exempt, specs and human documents linted); the `docs/superpowers/` freeze; the validate gate with the exact flags chosen.
- Consequences: per-feature change directories; archive-on-merge keeps `openspec/specs/` current; the feature-cycle skill (PR-2) builds on the schema; churn risk from a fast-moving dependency accepted, pinned exact.

- [ ] **Step 2: Lint the ADR**

Run: `mise exec -- vale docs/adr/00XX-openspec-artifact-layer.md && pnpm exec cspell --no-progress docs/adr/00XX-openspec-artifact-layer.md`
Expected: 0 errors from both.

- [ ] **Step 3: Update the ADR index**

Add the row to `docs/adr/README.md` following the existing table format.

- [ ] **Step 4: Commit**

```bash
git add docs/adr/
git commit -m "docs: adr for openspec artifact layer"
```

---

### Task 7: Pull request

**Files:** none (process step).

- [ ] **Step 1: Push the branch**

```bash
git push -u origin worktree-feature-cycle
```

- [ ] **Step 2: Prepare the PR command for the owner**

The `gh pr` mutation commands are blocked for the session; prepare the exact command and hand it over to run with the `!` prefix:

```bash
gh pr create --title "build: openspec artifact layer" --body "Adopts OpenSpec as the artifact layer per the feature-cycle spec (PR-1 of 6). Adds the recompose change schema, prose-gate globs, and a required validate gate. ADR included. Spec: docs/superpowers/specs/2026-07-26-feature-cycle-design.md"
```

- [ ] **Step 3: CodeRabbit round**

Follow the CLAUDE.md CodeRabbit protocol: judge every finding against docs and code, reply with the fixing commit or the rejection reasoning, resolve threads same-day.

---

## Self-review notes

- Spec coverage: Rollout item 1 maps to Tasks 1-6; the spec's prose-gate promise maps to Task 4; the standing gate rule maps to Task 5; the frozen `docs/superpowers/` needs no code change (the ADR records it).
- Known unknowns are handled in-plan, not deferred: validate flags on an empty tree (Task 2 Step 4 decides, Task 5 consumes), template support for glob artifacts (Task 3 Step 3 fallback), init touching linted files (Task 2 Step 3 guard).
- The spec also promises the feature-cycle skill, subagents, workflows, and the hook: those are PR-2 through PR-5 with their own plans, out of scope here on purpose.
