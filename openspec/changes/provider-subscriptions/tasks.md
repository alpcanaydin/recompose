## Implementation tasks

Five tasks. Tasks 1 and 2 run together on disjoint files. Task 3 waits on task 1, task 4 waits on tasks 1 and 2, and those two then run together on disjoint files. Task 5 waits on both, because it inspects the running app they produce.

Every task drives a failing test to green before its implementation exists, and every task reports the red run it started from.

- [x] **Task 1: contracts.** Owns `packages/contracts/src/`, and carries the consumer repair the version bump forces. Depends on nothing.
  - [x] The account row becomes a kind-discriminated union: the credentialed kinds keep their credential reference, and the subscription arm carries none.
  - [x] The kind enum gains `local`, and the document refuses a stored local row.
  - [x] The document moves to version 2, and the migration rewrites a version 1 subscription row to a key row so no subscription references the vault.
  - [x] The subscriptions module carries the standing, the provider identity, and the catalog entry.
  - [x] The channel surface gains the subscription channels with their request and response shapes.
  - [x] Type-level specs pin the union and the migration. A property spec proves any valid version 1 document migrates to a valid version 2 document with identifiers preserved.
  - [x] The consumers typecheck and pass again: the fixtures move to version 2, removal branches by kind, and the five channels register behind loud placeholders that task 3 replaces.

- [x] **Task 2: the kit and the tokens.** Owns the six `shared/ui` components with their stories, and both style files. Depends on nothing, and runs beside task 1.
  - [x] `Drawer`, on the dialog primitive the sheet already uses, with a heading, a trailing close, and no footer.
  - [x] `Chip` with a selected state, `Badge` for the plan, `StatusChip` for the dot beside the word, `OverflowMenu`, and `BrandMark`.
  - [x] The attention token pair the amber standing needs.
  - [x] Every component ships its stories sibling, and somebody looks at each one in both schemes before the branch leaves the machine.

- [x] **Task 3: main.** Owns `apps/desktop/src/main/subscriptions/`, the handler and dispatch files, the main entry point, both preload touches, and the mutation exclude line. Depends on task 1.
  - [x] The tool-presence check: a timeout-bounded login-shell path probe with a fallback to the process environment, then per-provider binary resolution.
  - [x] One config home per account under the app's own user data, and the active pointer with its heal on a removed target. The heal rides in `accounts:remove`, which is where a target stops existing.
  - [x] The standing observer, which answers from evidence and never answers connected without it.
  - [x] Credential custody on macOS: park before place, pointer last, single-flight, blobs opaque and never across the bridge. A denied prompt aborts before any write and answers with its own refusal. A presence check runs `find-generic-password` without `-w`, so watching standing never asks for the secret and never prompts.
  - [x] The five handlers behind the bridge, none of whose responses carry token material.

- [x] **Task 4: the renderer surface.** Owns the providers pages, the account entity, the sidebar widget files, the shared API, the fake bridge, the Storybook decorator, and the providers route. Depends on task 1 for types and task 2 for the kit, and runs beside task 3.
  - [x] The Subscriptions screen: heading, subtitle, the explaining empty state, and one row per account.
  - [x] The row: mark, name with plan, the address it signs in as, what it serves, its standing, and the overflow.
  - [x] A lapsed row reports the lapse and carries the way back on the row.
  - [x] The catalog drawer: search, chips, grouped rows, and narrowing that always answers a subset of its input.
  - [x] The fork, whose arms name what each yields rather than how many steps it takes.
  - [x] The sidebar gains the fourth kind so the group the reference draws is whole.

- [ ] **Task 5: acceptance and records.** Owns the end-to-end directory, the visual baselines, the readme, the dictionary, and the record with its index row. Depends on tasks 3 and 4.
  - [x] The four approved feature files graduate, driven against fake tool binaries on a search path the bed replaces rather than prepends to, because a prepended folder can't hide a tool the machine already carries. The fake `security` answers three shapes: `find-generic-password` without `-w` for presence, the same with `-w` for the blob, and `add-generic-password` and `delete-generic-password` for the writes.
    - Nine of the ten approved scenarios drive the running app. "A virtual model never offers a subscription target" waits on the composition surface, which no screen carries yet, so driving it now would pass without asking anything. It rides as an issue instead.
  - [x] `README.md` stops promising OAuth sign-in for Claude subscriptions.
  - [x] The guard that keeps the prohibition checkable: no screen offers a provider login for gateway use, and no vault entry holds a subscription token.
  - [x] Architecture Decision Record (ADR) 0069 records the custody decision, the platform split, and the alternatives the platform rules out.
  - [ ] The visual baselines regenerate from the label rather than from this machine.
