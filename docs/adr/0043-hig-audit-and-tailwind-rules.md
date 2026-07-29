# 0043: Three layers for Apple interface conformance

**Status**: Accepted
**Date**: 2026-07-29

## Context

recompose imitates macOS in a web renderer, so a fair question follows: how does anyone know the result honors Apple's Human Interface Guidelines (HIG)?

The premise needs correcting first. HIG is prose guidance full of judgement calls, and Apple publishes no conformance specification and no checker. Nothing certifies 100 percent. What exists is a set of measurable subsets, and the useful question names which of them this repository already covers.

The coverage already ran deeper than expected. `oxlint-plugin-react-doctor` already runs over three hundred rules at error, including twenty-three design rules and the accessibility family that any HIG-derived web ruleset repeats. The repository also carries a 1122-line `macos-design-guidelines` skill with numbered rules and severities, which the design critic cites by number.

Measurement settled the rest:

- `hig-doctor` over the whole `apps` tree scanned 90 code and 4 style files and reported one concern: a root element with no `lang`. A probe file of deliberate violations produced eight findings, so the scanner works and the tree was genuinely clean.
- That one finding is the shape of the real gap. `html-has-lang` was already set to error, and the linter never saw the file, because oxlint receives `*.{ts,tsx,mts,js,jsx,mjs,cjs}`. Pointing oxlint at an HTML or a CSS file answers "No files found to lint": it reads neither.
- Tailwind carried a second gap. Class strings held thirteen arbitrary values, three physical properties where logical ones belong, and eight wrapping inconsistencies, none of which any configured rule could see.

## Decision

Three layers, because no single one covers the ground.

**`hig-doctor` gates commits and continuous integration.** A root development dependency, `pnpm run lint:hig`, running `hig-doctor apps --fail-on moderate`. It runs in lefthook behind a `*.{ts,tsx,css,html}` glob and beside the other lint steps in the workflow. The tree passes at the strictest level today, so the threshold locks the current state rather than promising future cleanup. Its value is the file types oxlint refuses, since on TypeScript it repeats configured rules and found nothing.

**`oxlint-tailwindcss` carries the Tailwind rules, twenty-one of twenty-three at error.** It reads the `@theme` tokens, so it knows the palette: it rejects `bg-black` as an unknown class, because `theme.css` resets `--color-*` to `initial`. Two rules stay off, and both for a reason rather than a preference. `enforce-physical` inverts `enforce-logical`, so the pair can't both hold. Logical properties win, because they survive right-to-left. `no-restricted-classes` takes a list of classes to forbid, and no list exists yet.

**`hig-mcp` answers the judgement questions.** A Model Context Protocol (MCP) server covers 156 HIG topics with full-text search. It registers in `.mcp.json` through `pnpm exec`, like the other local servers, so it resolves through the lockfile rather than through `npx`.

Both packages install one release behind the newest, `hig-doctor@2.0.0` and `hig-mcp@0.2.0`. The newest of each was under the three-day `minimumReleaseAge` floor on the day of adoption, and the policy is the point.

## Alternatives

- **stylelint for the CSS gap.** Rejected on the numbers. Hand-written CSS is four files and 126 lines, of which 75 lines declare tokens, leaving three rule blocks in the whole application. More telling, the two real CSS defects found this week were a contrast ratio below the accessibility threshold and a `color-scheme` declaration on `body` defeating what it inherits. A CSS linter sees neither, because each one is a computed relationship rather than syntax. Three rule blocks don't earn a toolchain.
- **The `react-doctor` command-line tool for HTML and CSS.** Rejected because it doesn't do that. It scans React health, its lint is the plugin ruleset already configured, it scored 100 on this repository, and it never opens a stylesheet. Run against a directory with no React project it gates its rules off and says so.
- **Treating any of this as proof of conformance.** Rejected, and worth stating. Every gate here passed while a dark scheme rendered light, a row printed its label twice, an inert row looked live, a selected control sat at 1.05 to 1 against its track, and stories rendered at three times their intended width. Those are facts about appearance, and no linter sees them. The rule that a visual change gets opened in a browser before it lands stays the layer above these.

## Consequences

- This change fixes a missing `lang` attribute and a scaffold page title, both of which have shipped since the generator wrote them. Nothing else in the tree failed.
- `.html` and `.css` gain their first automated reader. No linter had ever opened the renderer's stylesheets or its single page.
- Tailwind class strings gain a contract. The layout numbers currently written as arbitrary values belong in `@theme`, which is where the layout contract already fixes them, so the rule pushes the design system in the direction it was going.
- Feature branches in flight will meet the Tailwind rules when they rebase, and the settings-screen branch carries twenty-four findings today. That work belongs to that branch.
- Two more dependencies, and one more failure mode in the commit path. Both tools are deterministic and neither calls a model, so a failure is reproducible.
