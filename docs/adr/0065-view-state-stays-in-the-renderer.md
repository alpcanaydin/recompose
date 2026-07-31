# 0065: View state stays in the renderer, apart from the settings document

**Status**: Accepted
**Date**: 2026-07-31

## Context

This change gives the renderer four facts to remember between launches. Which gateway a person looked at last. Whether the checklist stands folded. Whether the checklist stands dismissed. Whether the sidebar stands. All four live in `localStorage` under a `recompose.` prefix.

A rules review raised it. Before this change the renderer stored nothing, and the settings document held the only durable state the application owned. A version guards that document, a migration carries it forward, the main process owns it, and both the menu bar and the tray reach it. Four keys now sit outside every one of those.

The question is whether they belong in the settings document instead.

## Decision

**View state stays in the renderer, and the settings document keeps what a person decides.**

What happens when the value goes missing draws the line. A settings value carries a decision: a theme, a login item, a menu bar. Losing one undoes something a person chose, so it earns a version, a migration, and a path main can read. A view value carries where a person was: a scroll position, a fold, a selection. Losing one costs a keystroke, and no migration repays the effort.

All four keys are the second kind. A missing last gateway lands on the invitation. A missing fold opens the checklist. A missing sidebar state shows the sidebar. None of them refuse to load, none can be newer than its reader, and none can break in a way worth reporting.

**A view value main needs travels as a report, and stays where it was.** The window controls have to know whether the sidebar stands, so the renderer tells main over `system:sidebar-shown` (see Architecture Decision Record (ADR) 0064). A report keeps one owner. Moving the value into the settings document would give it two. It would also put a version and a migration behind a fold.

**The keys carry a `recompose.` prefix and a subject.** `recompose.gateways.last`, `recompose.get-started.collapsed`, `recompose.get-started.dismissed`, `recompose.sidebar.hidden`. The prefix keeps them clear of anything the renderer's dependencies write, and the subject names what forgets rather than what remembers.

## Consequences

**Good**: no schema version pays for a fold. The settings document keeps one meaning, which is the set of decisions a person made. Each view value reads and writes in one line, with no boundary crossing and no failure envelope.

**Bad**: these values never reach the config folder, so a person moving to another machine loses them without a word. Nothing validates them, so a hand-edited key falls back rather than reporting. A fifth key that turns out to be a decision rather than a view has to move, and moving it means writing the migration this record avoids.

## Alternatives

**Put all four in the settings document.** One store, one version, one owner, and main reads every value. It buys migrations for a fold and a scroll position, and it puts a boundary crossing between a person clicking a chevron and the chevron moving. Rejected as a cost with no matching gain.

**Give the renderer its own versioned store.** A second schema beside the settings one, with its own migrations. It answers a corruption question nobody asked, because none of these values can fail in a way a person would notice. Rejected as machinery ahead of a need.
