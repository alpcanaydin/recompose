# Subscriptions, and the flow that adds one

## Why

recompose has two ends and no middle. A person can connect an account, and a person can run a gateway that listens on its own port and answers a health path. Nothing joins them, so every model request a gateway receives draws a typed refusal naming the missing model.

The providers surface is the weaker end. It draws one flat list of every account kind over a form. That's neither the four destinations the sidebar promises nor a shape that says what a connected account is good for.

Discovery then reordered the feature before anyone could design it.

**Anthropic prohibits what the reference draws, in its own documentation.** The Claude Code legal page refuses third-party developers the right to offer a claude.ai login. It refuses the same for routing requests through Free, Pro, or Max plan credentials. Anthropic also enforces this rather than only writing it down. It checks client identity, and it turns away a subscription credential from anything other than the genuine Claude Code binary. The refusal names Claude Code as the only client that credential may serve.

So a gateway can't carry a subscription. Reaching upstream with plan credentials is the one act the terms name, and the wire refuses it anyway.

**A neighboring product shows what stays permitted.** The Claude Code account switchers store each account's credential, swap which one stands active, and hand login and refresh to the official command-line tool. They never make an inference request, so client identity never arises. That pattern is open to recompose, and this change takes it.

The inverse direction stays first-class. Anthropic documents pointing Claude Code at a gateway through `ANTHROPIC_AUTH_TOKEN`. What the terms refuse is recompose going the other way.

## What changes

**A subscription becomes a managed account rather than a gateway target.** Connecting one records the account and lets a person choose which of them the official tool runs as. It puts no credential behind a virtual model, because it can't. The screen says so, rather than leaving a person to find out at the first request.

**Login and refresh belong to the official tool.** recompose calls it instead of running an authorization flow of its own. Nothing here holds a rotating refresh token. That shuts out the failure discovery documented, where two holders race, one refreshes with a stale token, and every live session starts failing.

**The Subscriptions screen replaces the flat account list.** It carries a heading, a subtitle, an empty state that says what a subscription is, and one row per account. A row shows the provider's mark, its name and plan, the account it signs in as, what it's good for, and where it stands. An account whose authorization lapsed carries the way to restore it on the row, where the failure is, rather than in a banner over the list.

**Adding one opens the catalog in a drawer.** A search field, category chips, and grouped rows, the way the reference draws it. The drawer takes the container the inspector already uses.

**The fork after picking a provider keeps both arms and loses its framing.** The reference draws two roads to one place and labels them by how many steps each takes. They no longer reach one place. Signing in yields a managed account no gateway can route to, and a key yields a target every gateway can. The copy names what each arm gives instead of how long it takes.

**`README.md` stops promising what can't ship.** Its provider line offers OAuth sign-in for Claude and Codex subscriptions. That sentence turns false for Claude the day this lands.

**A repository guard keeps the prohibition checkable**, in the spirit of the guards that already refuse a forbidden alias and a commit to the protected branch. No screen offers a claude.ai login for gateway use, and no vault entry holds a subscription token.

## Locked decisions

### Maintainer decisions

- **Take the switcher pattern.** A person grants permission, the credential stays on the machine, and the official tool keeps making every request.
- **Hand login and refresh to the official tool.** recompose stores, lists, and switches. Building an authorization flow here would carry a rotating refresh token and the split-brain failure that comes with it, for a credential recompose can't use anyway.
- **Keep the drawer and the chips.** Four of the five references reach for a modal with a category rail, and the reference reaches for a right drawer with chips under the search. The drawer matches the inspector, and the chips arrived because the catalog outgrew one screen.

### Project-level decisions

- The fourth account kind, local runtimes, joins the sidebar so the group the reference draws is whole. Its surface follows in a later change.
- Machine-written discovery stays under `discovery/`, which the prose gates already exempt.

### Converged decisions

- **A subscription row states which quota pays before the first request, not after.** Discovery found the complaint class this prevents: a sign-in that mints a billable key without saying so.
- **A missing official tool is a stated reason, not a broken flow.** Connecting depends on that tool, so its absence reads as an explanation rather than a button that opens and dies.

## Layout contract

- The screen keeps the column width, the page inset, and the section rhythm the settings surface already uses.
- A row reads leading to trailing: mark, name with plan, account, what it serves, standing, and the overflow that holds the rest.
- The status word carries a mark beside it rather than color alone, which is what the field settled on and what a person who can't separate the hues needs.
- The drawer takes the inspector's container, its own heading, and a close control at the trailing edge of that heading.

## Design-system gap analysis

- **Brand marks.** The catalog needs one mark per provider, and the icon set holds none of them. They arrive as a named set rather than as loose files.
- **The chip.** A filter chip with a selected state has no component yet. The segmented control is the nearest neighbor and answers a different question, because a segment picks one of a closed set while a chip narrows a list.
- **The plan badge.** A small label riding beside a name at a smaller size than the note. Nothing carries it today.
- **The status chip.** The sidebar's status indicator paints a dot alone. This surface needs the dot beside a word, and the amber attention state has no token pair yet.
- **The drawer.** The reference names the inspector's container, and this repository holds no such thing. This change either builds it or borrows the sheet, and the solution design settles which.
