## Implementation tasks

Six tasks. Task 1 runs first and alone, because the version 4 bump must exist before anything can mint a local row, and every other layer imports what it exports. Tasks 2, 3, and 4 wait on task 1 and then run together, each on a tree disjoint from the other two. Task 5 waits on tasks 1 and 4, because it reads the widened `ConnectionWay` and `localRuntimeOf` that task 4 produces. Task 6 waits on tasks 2 through 5, because it drives the app they assemble.

Every task opens with a named failing test, captures the red run it started from, and drives it to green. Test code changes if and only if behavior changes.

- [x] **Task 1: contracts.** Owns `packages/contracts/src/`. Depends on nothing, and runs alone: every other task imports what it hands off.
  - [x] Opens red in `local-runtimes.test.ts`: the loopback schema admits `http://127.0.0.1:11434` and refuses `http://localhost:11434`, before the module exists.
  - [x] `local-runtimes.ts` lands as the local vocabulary: `localRuntimeIdSchema` holding `ollama`, the documented address table, the loopback-only address schema, and the three reachability verdicts as a discriminated union: `answers` with the version, `unrecognized` with the status, `unreachable` alone. A fast-check property pins that the schema admits exactly the strings that equal their own origin and name `127.0.0.1`.
  - [x] The accounts document moves to version 4: the credential-free `local` arm lands as a `strictObject` with `id`, `provider`, `kind`, and `address`, and the migration restamps the version and touches no row. A property proves any version 3 document migrates with every row byte-identical. `accounts.test-d.ts` pins that the local arm carries no `credentialRef` and no `label`.
  - [x] The engine protocol gains the `probe-runtime` directive arm carrying the loopback-schema address and the `runtime-check` report arm. Admission and refusal specs ride in `engine-protocol.test.ts`, and the type spec pins the widened unions.
  - [x] The channel surface gains `accounts:connect-local` (request holds the runtime id and nothing else), `accounts:detect-runtime`, and `accounts:check-runtime`. `ipc.test.ts` moves the roster to twenty-four, and `ipc.test-d.ts` pins totality. No local request schema carries a secret field.
  - [x] `vendorShapeOf` widens one way: a trim opening `sk-or-v1-` recognizes as openrouter, the return widens past the first-party id set, and a property pins that every recognized string still passes `pastedKeySchema`.
  - [x] `index.ts` re-exports the module, and every consumer typechecks and passes again.
  - [x] Layers: unit, property, and type-level.

- [x] **Task 2: the engine probe.** Owns `packages/engine/src/`. Depends on task 1, whose directive and report schemas it reads. Runs beside tasks 3 and 4 on disjoint trees.
  - [x] Opens red in `provider/runtime-probe.test.ts`: an injected fetch answering 200 with `{"version":"0.5.1"}` folds to `answers` carrying the version, before the probe exists.
  - [x] `provider/runtime-probe.ts` lands as the pure fetch-injected probe: GET `/api/version`, refused redirects, a three-second bound. The folding table: ok status with a parsable version body answers `answers`; any other HTTP answer folds to `unrecognized` with the status; a thrown fetch, a timeout, or a refused redirect folds to `unreachable`. A property pins one verdict per outcome and `answers` only on an ok status with a version.
  - [x] `engine-child.ts` dispatches the `probe-runtime` directive and posts the `runtime-check` report. The `RECOMPOSE_RUNTIME_ORIGIN` override rides beside the probe-origin override, honored for loopback hosts only.
  - [x] Layers: unit, property, and integration over the fake parent port.

- [x] **Task 3: main.** Owns `apps/desktop/src/main/` and `apps/desktop/src/preload/`. Depends on task 1 and runs beside tasks 2 and 4 on disjoint trees. Task 1 absorbed the handler skeleton, because the channel surface drives three total maps that live outside contracts, so this task wires the host into it.
  - [x] Absorbed by task 1: `local-runtimes-ipc.ts` with the three handlers and the vault-never-created killer, the `storage-ipc.ts` remove branch, `dispatch.ts` totality at twenty-four, the three preload entries, and the version 4 fixture.
  - [x] Opens red by flipping the transitional probe's own spec: `main/index.ts` still answers every detect with `unreachable`, before the host learns to ask the child.
  - [x] `engine-host.ts` gains `probeRuntime` and routes the `runtime-check` report. A dead child folds to `unreachable` with a sanitized log line naming the fold, and the host's wait bound stands above the child's fetch bound.
  - [x] The one-line wire at `main/index.ts` replaces the transitional probe, and `probe-runtime-until-the-host-answers.ts` retires with its spec.
  - [x] Layers: unit, integration, and property.

- [x] **Task 4: the catalog and the marks.** Owns `apps/desktop/package.json`, `pages/providers/model/`, `pages/providers/ui/catalog-list/`, `pages/providers/ui/providers-page/`, and `shared/ui/brand-mark/`. Depends on task 1 for types, and runs beside tasks 2 and 3 on disjoint trees.
  - [x] Opens red in `provider-catalog.test.ts`: `offeredUnder('local')` answers the Ollama entry and `awaitedFor('aggregator')` answers six, before the catalog grows.
  - [x] `ConnectionWay` widens to every kind, `CatalogProviderId` decouples from the mark type, and `localRuntimeOf` lands beside `signInProviderOf`. `keyKindOf` and `keyTitleFor` gain local-skipping guards with specs pinning that the Ollama entry answers neither.
  - [x] The Ollama entry joins `catalogEntries` with its documented-address benefit line. The awaited lists take the confirmed Soon rows: Together AI, Fireworks AI, Groq, DeepInfra, Cerebras, and Custom aggregator; LM Studio, llama.cpp, vLLM, and Custom local server. The `sk-or-v1-` hint joins the shape hints.
  - [x] `brand-mark.tsx` rebuilds over `@lobehub/icons` with `variant: 'color' | 'mono'`, the letter monogram retires, and the inventory covers every vendor with llama.cpp and the Custom entries on glyphs. The stories and browser tests walk both variants in both schemes.
  - [x] `catalog-list.tsx` drops the local special case, leads awaited cards with a mark or a glyph, and stops dimming the subtree: connectable draws color, Soon draws mono on tertiary ink, and the badge keeps full opacity.
  - [x] `providers-page.tsx` takes the aggregator subtitle the design states.
  - [x] Everything that reaches the screen gets the `claude-in-chrome` pass in both schemes before the task closes. The pass ran in the orchestrating session after the merge, with the badge and mark contrasts measured from the page.
  - [x] Layers: unit, browser, and story.

- [x] **Task 5: the local surface.** Owns `pages/providers/ui/` except the folders task 4 names, `shared/ui/status-chip/`, `shared/api/accounts.ts`, and `shared/testing/`. Depends on tasks 1 and 4, because it reads the widened `ConnectionWay` and `localRuntimeOf`. Runs beside tasks 2 and 3 on disjoint trees.
  - [x] Opens red in `detect-runtime-step.browser.test.tsx`: a seeded answer reads "Ollama is running at 127.0.0.1:11434." with the version beneath, before the step exists.
  - [x] `detect-runtime-step.tsx` lands with the three faces: Checking in the reserved-height slot, the answer sentence with the version, the silence sentence with Check again primary and Add anyway as a plain act. The look fires on entry, and the sheet's height changes exactly once.
  - [x] `local-runtimes-surface.tsx` and `local-runtime-row.tsx` land: the account list suspends, the standings settle per row with a Checking chip, the row reads the name over the mono address, and the overflow carries Check again and Remove. `local-runtimes-empty-state.tsx` says what the destination holds before a runtime connects.
  - [x] `status-chip.tsx` gains the inert tone: a tertiary-ink dot beside a secondary-ink word, because tertiary text measured under the contrast gate. The words: Running on positive, Not running on inert, Another server answered on attention, Checking on inert with no dot.
  - [x] `catalog-flow.tsx` stops excluding local in `connectStepFor`, the local sheet description rewrites, and `provider-connect-way.tsx` forks the local way to the detect step. `local-runtimes-note/` retires with its stories.
  - [x] `shared/api/accounts.ts` gains `useConnectLocalRuntime`, `runtimeDetectionQueryOptions`, and `runtimeStandingQueryOptions`, both query options forgetting on remount. The fake bridge gains the local handlers and the seedable reachability answer.
  - [x] Every new component ships its stories and browser-test siblings, and everything that reaches the screen gets the `claude-in-chrome` pass in both schemes before the task closes, run in the orchestrating session after the merge.
  - [x] Layers: unit, browser, and story.

- [x] **Task 6: acceptance and records.** Owns `apps/desktop/e2e/`, the visual baselines, `cspell-words.txt`, and `docs/adr/`. Depends on tasks 2 through 5, because it drives the app they assemble.
  - [x] Opens red by graduating the seven approved feature files from this change's `gherkin/` folder into `e2e/features/providers/`: every new scenario fails before the steps and the stub exist. Each feature file graduates together with its step definitions, one commit per file, so no commit is ever red.
  - [x] `runtime-stub.ts` lands as the loopback stub serving `/api/version` with scripted answers, silence, and strangers, handed through `RECOMPOSE_RUNTIME_ORIGIN` beside the probe and keychain overrides in `fixtures.ts`.
  - [x] The step definitions land per feature file: the catalog counts, the detect faces, the credential-free add, the add-anyway path, the standing words, and the no-Verify assertion, addressed by role and name.
  - [x] `catalog.feature` needed no shift: the key catalog's counts never moved, and no shipped file asserted the local Soon count.
  - [x] ADRs 0072, 0073, and 0074 land from the design's decisions 1 through 3, with their `docs/adr/README.md` index rows.
  - [x] `cspell-words.txt` gains the vocabulary the diff introduces: the runtime and vendor slugs plus the change documents' own words, verified with the gate run outside the worktree blind spot. The adversarial review caught the first sweep undercounting.
  - [ ] The visual baselines regenerate through the `update-baselines` label on CI, never a local run. The label goes on the pull request.
  - [x] Layers: end to end and visual.
