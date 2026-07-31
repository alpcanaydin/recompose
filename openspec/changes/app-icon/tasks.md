# App-icon tasks

> For agentic workers: use `superpowers:subagent-driven-development` to execute task by task. Every commit passes lefthook without a bypass. Global constraints: never commit to `main`, no code comments, test-first with the red run captured in the task report, and `pnpm run lint:openspec` stays green after every task. Read [design.md](design.md) before starting a task; it holds the decisions these steps carry out. Tasks own disjoint files. A task waits only when it reads what another produces, shares a file, or inspects what another writes.

## Task 1: Masters, palette, script, and gate wiring

**Files:** everything under `apps/desktop/scripts/`, `apps/desktop/build/mark.svg`, `build/mark-small.svg`, `build/icon.ico`, `build/icons/`, `build/volume.icns`, the deletions of `build/icon.png` and `build/icon.icns`, everything under `apps/desktop/resources/`, `apps/desktop/package.json`, `apps/desktop/tsconfig.node.json`, both vitest configs, `apps/desktop/stryker.config.json`, `knip.json`, and `cspell-words.txt`.

**Blockers:** none.

- [ ] **Step 1: The palette record.** `apps/desktop/scripts/brand-palette.mts` holds the seven anchors, and the pure `flattenOver` derivation landed beside the geometry in `icon-geometry.mts`. A spec pins every derived fill in `flattenedMarkFills` to the design's composited values.
- [ ] **Step 2: The geometry transforms.** Pure functions rewrite the tile and band radii per rendition through the concentric rule. A fast-check property pins the invariant: inner radius equals outer minus inset, floored at zero.
- [ ] **Step 3: The two masters.** `build/mark.svg` lands flattened: a 1024 canvas, no clip path, solid fills copied from `flattenedMarkFills`. `build/mark-small.svg` lands per the design's weight rules: the cream note, the dark contour, and stroke floors that survive 16 pixels.
- [ ] **Step 4: The container writers.** Pure functions write the `.ico` and `.icns` containers from rendered bytes. Round-trip specs pin the entry layouts the design names.
- [ ] **Step 5: The generation script.** `generate-icons.mts` renders every raster from the masters through `@resvg/resvg-js`, guards missing masters and size floors, and writes nothing partial. It registers in `knip.json`, joins typecheck, and runs as `pnpm run generate:icons`.
- [ ] **Step 6: The rendered assets land.** Run the script and commit its outputs: `build/icon.ico`, `build/icons/`, `build/volume.icns`, `resources/icon.png`, and the three tray files. Delete `build/icon.png` and `build/icon.icns`. Add `desktopName` to `apps/desktop/package.json`.

## Task 2: Builder keys, the rider, and the workflows

**Files:** `apps/desktop/electron-builder.yml`, `apps/desktop/src/main/index.ts`, `apps/desktop/src/main/menu/app-menu-template.ts` and its spec, `apps/desktop/src/main/tray/menu-bar-tray.ts`, `.github/workflows/release.yml`, `.github/workflows/ci.yml`, and `.github/workflows/homebrew-bump.yml`.

**Blockers:** none. It runs beside Task 1 on disjoint files.

- [ ] **Step 1: Explicit icon keys.** `mac.icon`, `win.icon`, `linux.icon`, and `dmg.icon` land with the design's paths, plus `linux.syncDesktopName`. Filename probing decides nothing anymore.
- [ ] **Step 2: The Recompose presentation.** `productName` turns title case. `app.setName('Recompose')` and the about panel land before anything reads the user-data path. The application-menu label moves with its spec, and the tray tooltip follows. The tray menu's prose items stay lowercase.
- [ ] **Step 3: The workflows.** Both mac legs pin to `macos-26`. The continuous-integration Linux leg builds real artifacts for the packaged lane. The homebrew cask template writes `app "Recompose.app"` and `name "Recompose"`.

## Task 3: The Icon Composer bundle

**Files:** everything under `apps/desktop/build/icon.icon/`.

**Blockers:** reads `flattenedMarkFills`, which Task 1 produces.

- [ ] **Step 1: The hand-authored bundle.** `icon.json` and the vector layers land per the design: the background tile with the concentric double frame, the note foreground, and the dark and mono appearance definitions.
- [ ] **Step 2: The maintainer verification chain.** An actool compile on the maintainer's machine, an Icon Composer eyeball of all three appearances, and the dock-size glass-edge check.

## Task 4: The packaged smoke assertions

**Files:** `apps/desktop/e2e/packaged-icons.spec.ts` and its `packaged-artifact.ts` helper, one `playwright.config.ts` line, one `knip.json` line, and the drift spec in `apps/desktop/scripts/brand-consistency.test.mts`. The 300-line cap forced the assertions out of `packaged-smoke.spec.ts`, which stays untouched.

**Blockers:** inspects the artifacts Tasks 1, 2, and 3 write.

- [ ] **Step 1: The artifact assertions.** Filesystem and property-list assertions land in the packaged spec, titled after the scenarios in `gherkin/app-icon/`. They cover the asset catalog and both icon keys, the `.ico` ladder with its small entries, the icon theme ladder, the directory icon, the desktop entry fields, the presentation names, and the no-scaffold-bytes check.

## Task 5: The record

**Files:** `docs/adr/0055-app-icon-identity-and-recompose-presentation.md` and the `docs/adr/README.md` index row.

**Blockers:** none. The design fixes the decision set.

- [ ] **Step 1: Architecture Decision Record (ADR) 0055.** The record lands through the `architecture-decision-records` skill, carrying the design's eight decisions with their alternatives and consequences.
