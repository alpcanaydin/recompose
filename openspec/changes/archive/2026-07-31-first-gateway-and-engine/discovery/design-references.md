# Design references

## The maintainer's reference

Claude Design project `fe80a39b-d78f-435b-a4f2-64f178c87145`, file `templates/onboarding/index.html`, card "Onboarding & empty state".

The project also carries `templates/gateway/index.html`, `templates/gateway-detail/index.html`, `templates/providers/index.html`, `templates/settings/index.html`, `components/shell/AppShell.jsx`, `components/shell/Inspector.jsx`, `components/canvas/NodeCard.jsx`, `components/canvas/Wire.jsx`, `components/core/Controls.jsx`, `components/core/Icon.jsx`, and token files under `tokens/`.

The onboarding template renders three beats, each in dark and light: empty state, create-gateway sheet, connect-provider sheet.

### Beat 1: empty state

- A dashed **ghost graph** sits above the call to action: two dashed node outlines labelled `Gateway` and `Virtual Model`, joined by a dashed path. 436 by 96 pixels, opacity `.75`.
- `h2` reads **"Create your first gateway"** at 17px/600, letter-spacing `-.3px`.
- Body copy: "A gateway is one local URL that routes requests across your AI accounts. Compose models, routers and targets on the canvas, everything stays on this Mac." 12.5px, `--label2`, max-width 410px.
- Two buttons: primary `Create Gateway` with a plus icon, secondary `Read the guide` with a book icon.
- Under them, `or press ⌘ N` at 11px mono in `--label3`.
- A floating **Get started** checklist card sits bottom-right, 250px wide, tracking 4 steps with ring markers (current, done, pending) and a `Skip setup` footer.

### Beat 2: create-gateway sheet

- Sheet is 404px wide, centered at `top:47%`, radius 13px, over a `rgba(0,0,0,.42)` scrim (`.18` in light).
- Header: bold 16px title **"Create a gateway"**, then 12px `--label2` description "Name it and pick where it serves. You can recompose everything later."
- A grouped `.box` holds four rows at 38px minimum height, each a label on the left and a control right-aligned: **Name** (text input, 170px), **Slug** (mono input, 170px), **Port** (mono input, 74px), **Start automatically** (switch, on).
- Under the box, the live preview line `.urlprev`: a 7px grey status dot, then `Serves at ` in `--label2`, then **`http://localhost:8397/my-gateway`** bold in `--label`. Mono, 11.5px.
- Footer: `Cancel` then primary `Create Gateway`.

### Beat 3: after creation

- Sidebar group **Local Gateways** holds a selected row `my-gateway` with a network icon and a trailing 6px status dot. `.dot` is green, `.dot.off` is `--label3`.
- Below it a `New Gateway…` row renders in the accent color with a plus icon.
- The toolbar carries a play button that turns green once a gateway exists (`.pi.go`), and a monospace URL pill: a status dot, `http://` dimmed, `localhost:8397`, `/` dimmed, `my-gateway`, then `— stopped` dimmed, with a copy button pinned right.
- The canvas holds one gateway node card, 158 by 78, teal-tinted, reading `Endpoint` over `/my-gateway · :8397`.
- The bottom status bar carries request rate, p95, client count, token rate, spend, and node and wire counts.

## Conflicts with the feature request

The reference is a mock, not a specification. Two rows in its sheet fall outside this change.

- **The port row.** The request drops it: the port lives in settings and applies to every gateway at once. The preview still reads the stored port, so the sheet shows the port without asking for it.
- **The "Start automatically" switch.** The request drives start and stop from the screen and names no autostart. The settings screen already renders a gateway-autostart row as unavailable, so an autostart switch here would contradict it.

## Beyond the requested scope

The reference draws these, and the request names none of them. Each needs an explicit in or out decision at the brainstorm.

- The Get started checklist card and its `Skip setup` footer.
- The `Read the guide` secondary button.
- The `⌘ N` shortcut hint.
- The toolbar URL pill and its copy button.
- The bottom status bar and every metric on it.
- The canvas node card for a created gateway.

## Mobbin references

Searched `web` on 2026-07-30.

### Create sheet with a live address preview

- [Dub, new link](https://mobbin.com/screens/16e906c4-9bea-40af-8eb1-7166f49782b6) is the closest match. A short-link field sits beside a domain selector, and the composed address reads back under it. The slug field carries its own validity marker inline rather than in a summary.
- [v0, create a new project](https://mobbin.com/screens/07e4d332-7800-4b20-8a18-68b966648ac4) shows the minimum viable shape: one required name field, `Cancel` and `Create`, nothing else.
- [Uxcel, final touches](https://mobbin.com/screens/15adbf93-32c0-484f-b7d2-528eb5165524) shows a project-link field rendered as a full address rather than a bare slug.
- [Wrike, project name](https://mobbin.com/screens/04e66515-2099-49ae-8a82-1a575929f38a) pairs a single field with a live preview of the thing being created.
- [Replit, app settings](https://mobbin.com/screens/400700cc-14fb-4c5b-a9a3-b30f0aa67c9c) shows name and description in a compact popover rather than a centered sheet.

### Sidebar rows carrying a running state

- [Relevance AI, queues](https://mobbin.com/screens/40ba5a22-8567-4808-86e7-9186146433c0) is the closest match. Each sidebar row carries a colored dot and the word `Active`, with a secondary line under the name. The dot and the word travel together rather than the dot standing alone.
- [Rox, accounts](https://mobbin.com/screens/daa7d1de-ad52-4dda-a207-2ed29613e0b0) pairs a green dot with `Available` and a grey pill with `Unavailable`, so the two states differ in shape rather than in color alone.
- [Google Workspace, service status](https://mobbin.com/screens/6eb3327d-f5f7-4b89-9972-eeabd11013f2) writes the state as words in a column, with no dot at all.
- [Discord, channel list](https://mobbin.com/screens/41569d3a-b3ca-43b3-b4b6-e3ad9eeacab3) shows the sidebar group-and-row rhythm the reference borrows.
- [n8n, credentials](https://mobbin.com/screens/21e4e69e-5eb5-47dd-8de2-096b40961c7a) lists connected resources with a per-row secondary line carrying the last-updated time.

## What the references imply for accessibility

Every reference that reports a running state pairs the dot with a word or a shape. The reference template carries a bare dot in the sidebar and the word only in the toolbar pill. A dot alone fails the non-color requirement, so the sidebar row needs a text equivalent that a screen reader reaches.
