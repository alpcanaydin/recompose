# recompose: brainstorm decision journal

_Living notes: updated throughout brainstorming. Translated to English and reconciled 2026-07-21. Entries marked **SUPERSEDED** were overridden by later locked decisions. The design system (claude.ai/design project "recompose-design-system," `design-system/library/`) is the source of truth. The current consolidated spec is `docs/superpowers/specs/2026-07-20-recompose-design.md`._

## Project summary

An open-source, local (desktop), offline-first **AI gateway composer**. The user connects AI accounts/providers, creates virtual models on a node-based canvas and wires them to providers. Clients (Claude Code, Codex, Cursor…) see only the virtual models. Failover/round-robin routing runs between the two.

## Settled decisions (from conversation)

- **Purpose:** not a gateway → orchestration/composition. "Wire up your own AI network."
- **License/intent:** open source, no commercial intent. Name: ~~`rewire` (fine as a codename)~~ → **renamed `recompose` (recompose.sh), 2026-07-21.**
- **Form:** desktop app, offline-first, credentials stay local.
- **Core UI thesis:** node-based visual canvas (Intercom Series-like): the user pulls the wires.
- **Abstraction:** virtual/custom model → provider mapping. Each gateway is its own set.
- **Routing:** failover + round-robin (+ possibly cost/policy later).
- **Protocol translation:** Anthropic ↔ OpenAI (both directions). **Later locked (2026-07-21): every gateway always serves both dialects on one base URL. Paths disambiguate (`/v1/messages` vs `/v1/chat/completions`). No protocol subpaths, no per-gateway protocol type.**
- **Provider kinds:** official OAuth (Claude/Codex subscriptions, confirmed working), OpenAI-compatible & Anthropic-compatible (URL+key+header), local (Ollama/LM Studio/vLLM) in the future.

## Settled (brainstorm)

- **Primary scenario:** (D) community tool: broad audience from day one, many providers, polished UI. For the community more than for oneself. → UX + cross-platform quality first.

- **Runtime/stack (CURRENT: pivoted to Electron):** **shell: Electron 30+**. ~~**Bun** = backend/sidecar (gateway engine + protocol translation)~~ **SUPERSEDED (2026-07-21): Bun removed entirely.** The gateway engine runs on Electron's bundled Node inside a **`utilityProcess`** (crash isolation, UI thread stays clean): no separate binary to compile/sign/notarize per platform, no sidecar lifecycle management, single electron-builder chain (incl. `electron-liquid-glass` native rebuild). Node's `http` + Server-Sent Events (SSE) streaming is more than enough for local proxy traffic at low Requests Per Second (RPS). The engine stays an **isolated pure-TS package** (`packages/engine`, zero `electron` imports) so a future headless/CLI mode remains possible. Tooling: **pnpm workspaces + Turborepo**, single lockfile, vitest. **Scaffolding (2026-07-21): electron-vite** (`create @quick-start/electron`), the 2026 de-facto standard (main/preload/renderer separation, Hot Module Replacement (HMR) incl. main process, packages with electron-builder under the hood, which the `electron-liquid-glass` native-rebuild chain needs anyway). Electron Forge and webpack-era boilerplates eliminated. Scaffold `apps/desktop` with it, then fold into the pnpm workspace. Frontend web (React/Svelte TBD). **Why the pivot to Electron:** true native Liquid Glass (Meridius-Labs/electron-liquid-glass, `NSGlassEffectView`) needs `BrowserWindow.getNativeWindowHandle()` → Electron-specific, doesn't work with Electrobun's Bun+Zig webview. It was already the documented fallback. Trade-off: 80–150 MB bundle (acceptable for an OSS pro tool). ~~Electrobun~~ eliminated.

- **Build order:** **UI-first.** The team designs and builds the app's visuals/UX end-to-end first, then wires in the backend afterward. The backend adapts from existing OSS (cliproxyapi / opencodex / ccproxy): nothing new to prove there.
- **Focus of this brainstorm:** UI/UX design (screens, canvas, flows, design language).

- **Information architecture:** (B) multi-screen + **canvas per gateway.** Left nav: Gateways / Providers(Accounts) / Logs / Settings. Entering a gateway opens that gateway's own canvas (virtual models ↔ providers wired). Easy to learn, scales. (A "everything on one canvas" eliminated.) _Later simplified: see "IA (simplified)" below. This later revision dropped the top-level Logs surface._
- **Live flow visualization:** **live traffic animation** on the wires: green dots flowing along the cable as clients use the gateway. Real-time sense of activity. (Signature feature.)

- **App shell:** (A) **single grouped left sidebar (~220px) + main canvas.** n8n/Vapi/Linear style. Sidebar grouped with headers (Gateways / Setup / Observe). Top-tabs and 3-pane eliminated (You Aren't Gonna Need It (YAGNI): revisit 3-pane if account counts explode).
- **Sidebar gateway list:** (Slack-channel pattern, approved). The **GATEWAYS** group reads like a Slack channel list. Click → that gateway's canvas opens (each gateway = a persistent, named context). `+ New gateway`. Ref: ClickUp Channels, Asana Projects colored dots, Coda/Airtable grouped lists.
  - **Row format:** ~~name **+ port** (for example, `my-gateway · :8787`)~~ **SUPERSEDED:** with the single-port + path model the row is `name` + status dot only (leading neutral teal `net` icon, since gateways are never branded). The full address lives in the toolbar pill.
  - **Live status dot (tied to the signature):** in Slack a dot = unread. Here = **live health/traffic** → 🟢 pulse (requests flowing/healthy) · ⚪️ gray (idle) · 🟡 amber (a target rate-limited, failover active) · 🔴 red (stopped/error). Optional trailing request counter (like an unread badge). You can see which gateway is "breathing" without entering its canvas.

- **CRITICAL CHARACTER: DESKTOP app, not web.** Native desktop feel is mandatory: title bar / window controls (macOS traffic lights), native-feel sidebar, menu bar, dense & keyboard-first, NO "browser tab" feel. Reflected in all mockups.
- **Reference language:** node canvas → n8n + Intercom Series. Left nav → Vapi/Linear. Note: those are web references. This project pulls them toward desktop character.

## Mobbin reference IDs

- n8n canvas: 817531c3-11e0-4638-bdc2-831ab9adb3a4
- n8n node sub-connections: 5c3ae3aa-7f77-49cd-9c31-3ae1ceff8a50
- Intercom Series: cb6e5ce9-733d-470c-a5d5-70dcfb99ad36
- Vapi left nav: c8d89b3e-009b-49ee-91e7-05b07712fef5
- Provider hookup (session): Claude Code OAuth-vs-token 764751b1-d951-4e21-8b48-48dcff556d25 · Vercel Bring Your Own Key (BYOK) 6cf10946-059f-4b49-b0b6-392d4b8e9863 · StackAI e2ef1a4a · Buffer 4497b606
- Node/wire states (session): n8n error node f70fc619 · n8n success wire 10ed667a · Zoho execution legend (Success/Running/Failure/Aborted) · Zapier step badge+Success/Error 3b094611 · Retool corner dot df435d60 · Better Stack status fccc7b7d · incident.io degraded 12799f14 · OpenAI service health d605f83d

- **Target OS:** **macOS-first character, but every platform.** Full native feel on macOS first (traffic lights top-left, sidebar vibrancy/translucency, SF feel). The architecture supports Win/Linux too. macOS polish is the priority but not macOS-only.

- **Design language:** (A) **native macOS** base: neutral grays, real vibrancy sidebar, systemBlue accent, restrained/clean, "Apple's own dev tool" feel. **SIGNATURE:** direction B's green flowing wire glow lives inside A as the accent (live traffic = green flowing dots). Both native and distinctive. _Later locked concretely as **Mac Native (explorations 08 dark / 09 light, TablePlus flavor)**. This locked direction eliminated the Liquid Glass-heavy variants._

- **Canvas node model (the heart):** chain left→right: **Gateway (endpoint) → Virtual Model → [Router] → Target (Account+Model)**.
  - **Router:** explicit node (Q7-A). Modes: failover / round-robin (+ future cost/latency/weighted). Chainable. A VM can also go straight to a single target (router optional).
  - **Leaf = merged target node (Q-A):** "account · model" as one card, the model as a dropdown inside the card. Picking an account **automatically fills** that account's real models into the dropdown. Different models of the same account get separate cards (flexibility kept, canvas stays clean).
  - **Multiple VMs:** one gateway serves several virtual models. All exit from the single Gateway endpoint node. Clients see these VM names.
  - **Node types:** Gateway, Virtual Model, Router, Target(Account+Model). (Account/Provider definitions live on a separate screen. The canvas references them as targets.)

- **IA (simplified):** only **3 top-level surfaces: Gateways / Providers / Settings.** _(Usage later joined as a System item: the shipped sidebar is Local Gateways / Providers / System: Usage · Settings.)_
  - **Providers** = all connected AI sources (OAuth accounts + API-key endpoints) in one place. NO separate "Accounts" screen.
  - **Everything gateway-specific** (name, path, logs) → **click the Gateway node → its panel opens.** NO separate top-level Logs screen. ~~(logs as a tab in the gateway's own panel)~~ **SUPERSEDED (2026-07-21):** logs aren't an inspector tab either. The inspector is Overview + Connect only. The log stream lives in the **full-width bottom panel** (toolbar toggle), scoped to the current selection.
  - **Node settings:** clicking any node type (VM, Router, Target, Gateway) opens its settings. The behavior stays consistent across node types.
  - Onboarding/Client-export aren't separate top-levels. They live in the flow (gateway panel "Connect a client" / first launch).

- **Node settings panel:** (A) **right inspector/drawer**, macOS-native (Xcode/Keynote/Figma inspector precedent). Not a modal (modals = one-shot tasks/confirmations). Maybe a node-attached popover for light nodes later. Canvas + flowing wires stay visible.

- **Provider hookup flow:** (A) **catalog → right drawer.** Providers list + "+ Add provider" → catalog. Picking a provider opens a **right drawer** (consistent with the inspector decision). Inside, per provider, **Claude Code's OAuth-vs-key fork**: a "Sign in (Fewer steps)" OAuth card + an "API key (More flexible)" form (base URL + key + optional header). Local is URL-only later. Ref: Claude Code "Connect with GitHub," Vercel BYOK. Modal (B) and single-page list (C) eliminated.

- **Router node: mode → visual.** One Router node type. **The user picks the mode, the visual follows.**
  - **failover** → **priority ladder**: targets ordered (1→2→3 badges), traffic always to the topmost healthy one. #1 rate-limits/errors → its wire **dies (dashed+✕)**, the green flow shifts down one (the C failover story). Order changes by dragging.
  - **round-robin** → **equal shares**: a share bar inside the router (Vercel %-distribution), dots flow along each wire in turn. Later **weighted** = draggable 60:30:10% bars. If an account drops, its share redistributes (the bar updates live).
  - The user edits mode and target order/weights **in the right inspector**. The C status language is consistent in both modes. Ref: OpenAI/Typeform/ManyChat fan-out branches, Vercel weighted %, Cloudflare LB.
  - **Multi-mode / nesting (open end #1, CLOSED, A):** every Router is **single-mode** and carries a **mode pill** (`⇄ round-robin` / `↓ failover`) → intent readable at a glance. Combinations (for example, falling back only when a round-robin pool runs dry) come from **chaining routers**: a failover router's `#1` slot feeds a round-robin router (the pool), `#2` feeds the standby target. The two visual languages stay cleanly apart: round-robin wires carry **% pills + slider** ("Distribute evenly," Customer.io Random Cohort Branch), failover carries **numbered slots (#1/#2) + dashed "standby"** (Calendly "routes run in order" + Cal.com "Fallback Route"). Targets **always remain separate "Account·model" cards** (card language + flowing dots on every wire preserved). Eliminated: **B** (nested brackets inside one node, which turned targets into in-node rows and swallowed the animation), **C** (no mode, per-row priority+weight, which hid the intent). Companion: router-modes.html. Ref: OpenAI If/else "Else" branch. A natural consequence of the locked "chainable router" rule.

- **Node & wire live status language:** (C) **wire color/flow + corner badge together: fancy.** The wire carries the signature (flowing green dots, canvas always alive). Color gives at-a-distance status (green=flowing / amber=rate-limit 429 / red=error / gray=idle). The corner badge gives precise close reading (✓ / ⏱ / ✕ / ↻). **Key: it turns failover into a visual story**: the rate-limited/failed account's wire goes **dashed-dead** + red ✕, traffic **shifts** to the standby account (the green dots flow there). Visual proof of the orchestration thesis. The brief **requested "as fancy as possible":** glow, flow animation, failover transition animation, node border pulse. Ref: n8n (border+badge+toast), Zoho (Success/Running/Failure/Aborted legend), Zapier (badge+Success/Error branches), Better Stack/incident.io/OpenAI (status dot+uptime). A (color+glow only) and B (badge only) eliminated.

- **Virtual model creation:** (A + A1 continuation). A VM = the **alias** the client sees. The real model stays hidden. Definition = **name + ≥1 target**, and it's a **draft** until wired (amber `!` badge, "no target"), **live** once connected (green ✓, dots flowing).
  - **Birth (A):** drag from a port → the VM appears with an **inline name** editor (Ditto), confirmed with ↵. Mapping isn't a separate form: it's **visual wiring**.
  - **Continuation (A1):** **immediately after** ↵ the output port enters "connect" mode (pulsing) + a **port-attached picker** opens (Langdock/Attio). Grouped: **Route To Target** (list of connected account·models) / **OR** (⤨ add a Router · + connect a new provider). Searchable. `esc` → leave as draft. The same picker appears on port-drag and ⌘K (consistent). The flow itself closes the "a name isn't enough" gap.
  - **Optional (not required, in the inspector, later):** default temp/max_tokens, system-prompt prepend, header override, rate-limit policy, fallback behavior. Ref: Ditto inline naming, Langdock Swap Node categorized port menu, Attio Next-step, Intercom grouped dropdown.

- **Client hookup / export:** (A base + C accent). Clients are CLI tools (Claude Code/Codex/Cursor), not Python → they connect via env (`ANTHROPIC_BASE_URL`/`OPENAI_BASE_URL`) or a config file. Home: **gateway node panel → "Connect" tab** (+ onboarding ③).
  - **A default:** client tabs → each tab a client-specific **ready snippet + Copy**. The header shows the endpoint URL (copyable) + chips for the **model names** the client will see. Universal, always works. Ref: Vercel/Perplexity/Neon language-tab+copy code blocks. _Shipped in the DS as mini-tabs **Claude Code / OpenAI / cURL** over a single "Base URL · serves both dialects" box. No key appears by default. A token box + `ANTHROPIC_AUTH_TOKEN` line appear only when Settings requires it (see "Local auth," below)._
  - **C accent (the desktop proof):** if recompose **detects a client locally**, that tab shows **"Configure automatically"** → recompose writes the config file (for example, `~/.claude/settings.json`) **for you**, with **Undo**. Manual snippets remain the fallback. _Still planned. Not in DS template v1._
  - **B eliminated** (a single raw URL card is too minimal, leaves novices at "where does this go?") but B's URL+models card survives as A's header.

- **First launch / onboarding:** (A base + B touch). **NO signup** (offline-first, credentials local). Onboarding isn't registration: it guides from an empty app to the **first working chain**: connect a provider → create a gateway → connect a client.
  - On first launch, a **persistent checklist card** over the empty canvas (① Connect a provider ② Create a gateway ③ Connect a client) follows Render/Retool clarity. Each step opens its own **drawer/sheet** (consistent with the inspector decision). Finished steps get ✓.
  - At the "create a gateway" step the card **slides aside**, a **ghost chain** (faint Gateway→VM→Target skeleton) + a **single coach mark** drop onto the canvas → the canvas teaches **port-drag** right there (B, canvas-native, matches the node-creation decision).
  - **Subsequent launches** skip the checklist, straight to the canvas. This decision eliminated a full wizard (C): it steals the desktop soul and the signature canvas from the first moment. Ref: Render empty state, Retool "Get started" card, Vercel connect-provider step (minus their signup).

- **Logs / monitoring:** ~~(A base + B "expand" accent, logs as a drawer tab, expandable into a bottom dock)~~ **SUPERSEDED (2026-07-21):** no top-level Logs page and no inspector Logs tab. The log stream lives **only in the full-width bottom panel** (toolbar toggle), **scoped to the current selection**: "the bottom bar shows the selection's logs." Content stays routing-centric, not generic API logs: which VM → which account·model won, the failover/rate-limit story, tokens/latency/cost. Row: `time · status · VM → target | upstream · account | code | latency`. Filter chips: All/Errors/per-VM. Live tail. The canvas stays above with wires flowing. C (full-screen takeover) had already disappeared. Ref: Stripe Logs, Supabase, Base44, ElevenLabs, Vercel Live tail, WRITER.

- **Gateway lifecycle:** (A+B+C all: full access everywhere). A gateway = a list item **+ a running server**, so the primary action is **start/stop**.
  - **Sidebar (speed):** the status dot is a **one-click start/stop toggle**. Hover `⋯` (right-click same) → Start/Stop · Rename · **Duplicate** · Delete. Rename also **double-click inline** (Coda). ~~Port değiştir~~ (no per-gateway port in the single-port model).
  - **Toolbar (authority):** _originally "drawer Overview header," and the authority home moved to the top toolbar_: start/stop toggle in the left capsule + `⋯` menu (Rename · Duplicate · Delete…) + the danger-zone Delete confirmation.
  - **Destructive actions confirm:** delete modal ("connected clients will lose this endpoint · can't be undone").
  - **Duplicate (valuable for a community tool):** copies the config, appends "-copy" to the name → shareable-template feel. ~~port auto +1~~ **SUPERSEDED:** single port + path-per-gateway. A duplicate gets a new path on the same port.
  - Ref: Coda sidebar `⋯` (Rename/Duplicate/Delete + right-click), Toggl `⋮`, Lemni Edit/Remove. This design's addition = Start/Stop on top (the server difference).

- **Error states:** (A base + B layer). Principle: **NO full-page takeover** (Buffer/Veed/Monarch anti-pattern). Errors live where they happen. Better Stack's "localized status" direction is right.
  - **Taxonomy:** ① node/wire routing (429/500/down) → **the already-locked wire/badge language** (dashed-dead wire + ✕, green flow shifting to failover). ② App-level (port taken, OAuth exhausted, offline, config unwritable) → not owned by one node → banner/toast. ③ Provider/account (auth expired, invalid key, quota) → badge on that row/node + drawer "Reconnect." ④ Catastrophic crash (rare) → the single exception, full-screen fallback accepted.
  - **A backbone (in-place/localized):** every error at its exact node/wire/row, with "why + Retry" beside it. One-to-one with the signature status language. No takeovers.
  - **B accent (banner+toast):** only for app errors not owned by a node: a thin top banner (port taken→"Change port," OAuth→"Reconnect," offline) + inline action. Transient events appear as toasts. The canvas is never blocked.
  - **C eliminated (separate health center):** by the same logic that killed top-level Logs: sidebar live dots + node/wire status already aggregate health, so a separate center is redundant. Ref: Better Stack, Google Meet inline recovery.
  - **Empty states:** solved in onboarding (empty canvas + checklist + ghost chain). Other gaps (no providers → "Connect" Call To Action (CTA), no logs → "waiting for the first request") share the same quiet inline language.

- **Node creation / wiring:** (A + C together). **Primary:** drag from a port → on release a "what should this connect to?" menu (n8n logic, discoverable). **Power user:** ⌘K command palette to search-insert nodes (keyboard-native, Linear/Fey/Raycast language). NO left palette (B): no screen cost, the port-drag menu already presents the types.

- **Local auth & network exposure (LOCKED 2026-07-21: added post-brainstorm, LM Studio model):** this design rejected the contextual-key idea (require a key only when bind equals Local Area Network (LAN)) as too hard to explain. After web research (Ollama's refusal of API keys, plus Common Vulnerabilities and Exposures (CVE) advisory CVE-2024-28224 on Domain Name System (DNS) rebinding, and LM Studio's flat toggle): ① no API key in the default UI. ② the engine validates Origin/Host headers (DNS-rebinding hardening, spec-only, invisible). ③ one flat always-visible **"Require API token"** switch in Settings › Server, off by default: recompose fronts **paid accounts**, so serving on LAN without a token would be quota theft. ON reveals the token row (`rc-local-…` + Copy + Regenerate) and grows the Connect tab with an `ANTHROPIC_AUTH_TOKEN` line. Spec'd in DS templates (gateway-detail screen 3, settings).

## Design language (style foundation, companion: style-foundations.html)

> **SUPERSEDED as a whole (2026-07-20):** this Liquid Glass-heavy section was the pre-exploration direction. The locked direction is **Mac Native (explorations 08 dark / 09 light, TablePlus-style flat pro tool)**: vibrancy only in the sidebar, flat opaque chrome elsewhere, **full-tint node borders** (not the "3px left spine on monochrome cards" idea below), flow green `#32d74b` (dark) / `#1a9e33` (light) rather than `#7dffb0`. Kept for history:

Reference: Claude / ChatGPT / Codex desktop language (Mobbin web) + **Apple Liquid Glass** (Apple's Worldwide Developers Conference (WWDC) 2025 / macOS Tahoe 26, and the Mobbin ios collection: Glass, Comet, Tide). Core traits: **Liquid Glass material · monochrome-first · one frugal accent · typography carries hierarchy · native controls · red only for destructive**.

- **MATERIAL = native Liquid Glass (old decision):** not CSS-fake glass. Native `NSGlassEffectView` behind transparent web content (macOS 26+, with `NSVisualEffectView` as the fallback below). Layers: highlight (specular light) · shadow (depth separation) · illumination. Window + sidebar + floating panels (drawer, toolbar, ⌘K palette) = glass. Web backgrounds transparent in those areas so the native glass shows.
- **Surfaces (tone-on-glass logic):** glass material native. On the web side: dark semi-transparent tones for the content layer over glass, opaque card/node `~#212127`, hairline separators/edges `#2a2a30`, and specular edge as a thin light inset. (In claude.ai/design previews, CSS glassmorphism simulates the glass: blur+saturate+inset specular. The real app uses native glass.)
- **Accent + signals:** systemBlue `#0a84ff` **only** for selection/active/primary action + focus rings. **The single live signature = flowing-traffic green `#7dffb0`** (recompose's brand moment, like Claude reserving its color for the logo, but only on live traffic). Amber `#f5a623` = rate-limit/429. Red `#ff453a` = errors/destructive only.
- **Rule:** chrome stays grayscale. Color only when it carries **meaning**. _(This rule survived into Mac Native.)_
- **Typography:** SF / `-apple-system`. Hierarchy via **size+tone**, not color/boxes, with negative letter-spacing on large titles and calm body. Text layers: primary `#f5f5f7` · secondary `#a0a0a8` · tertiary `#6c6c73`.
- **Controls:** pill toggle (on=systemBlue), segmented control, dropdown chevron, rounded button `r=8`, and thin monochrome SF-Symbols icon language. Cards/drawers `r=10–12`, airy padding.
- **Node language (old decision, SUPERSEDED):** ~~all nodes the same monochrome card (`#212127`); the type color (Gateway gray · VM blue · Router orange · Target purple) lives only as a thin 3px left spine~~ → the locked direction uses **full-tint node borders** and Gateway = **teal** (this decision eliminated the gray gateway). The only truly live element on the canvas is still the flowing green dots.

## Gap sweep (secondary surfaces)

- [x] Gateway lifecycle (start/stop/rename/duplicate/delete) → A+B+C all (sidebar speed + toolbar authority + confirmation)
- [x] Gateway detail IA + "Overview" tab content → see below
- [x] Canvas crowding → free-drag base + A navigation + B opt-in Tidy + C folding (see below)
- [x] Settings content → B single-column grouped + ⌘, focus (see below)

### Settings screen (see settings.html)

Layout decision: **B: one scrollable grouped page** (NO category rail, escapes the double-sidebar, content is small). macOS grouped-card language (Google Drive/System Settings). Click the "Settings" surface in the main sidebar → opens in the content area. **⌘,** focuses this surface, doesn't open a separate window (preserves the IA lock). **C (separate Preferences window) eliminated.** If content grows, promoting to A (category rail) is easy.
~~Original draft groups (General/Appearance/Advanced/Updates/About)~~ **SUPERSEDED: shipped DS structure (source of truth).**

- **General:** Launch at login · Show in menu bar · Start gateways on launch.
- **Server:** Default port (:8397, single port) · Bind address (Localhost only / LAN) · **Require API token** (+ revealed token row: `rc-local-…` + Copy + Regenerate).
- **Appearance:** Theme (System/Light/Dark) · **Reduce wire motion** (the signature flowing-dot effect, for low-power mode).
- **Data:** Config folder `~/.recompose` + "Reveal in Finder" · Keep request logs (24h/7d/30d) · Telemetry: "None: recompose never phones home" (offline-first, stated explicitly = trust).
  Deferred from the draft: accent-color picker · config export/import · auto update group + "Check now" · request-timeout default.

### Canvas crowding (see canvas-scale.html)

This project's graph stays fixed-layered: Gateway → VM → [Router] → Target. Crowding comes from parallel VM count (1 gateway × N virtual models × M targets stacking vertically).

- **Base = free drag** (n8n-like manual positioning). User decision: automatic layout isn't the backbone.
- **A (always) = standard graph controls:** corner minimap + zoom cluster (⊞ fit · −/+/% · ✋ pan · ↺). Vapi/WRITER standard. Default navigation layer. _(Shipped: zoom cluster bottom-left, minimap bottom-right.)_
- **B (opt-in) = automatic layered layout** only when the user hits **"✨ Tidy"** → nodes snap into Gateway·VM·Target columns. Not continuous/automatic, one click.
- **C = collapsible VM strips:** each VM is a strip: the focused one stays open (targets visible), the rest fold to one line ("fast ▸ 2 targets"). Vertical scale for many VMs. A mini status dot on the folded strip (instead of live wires).
- Plus: the sidebar toggle (⌘\) gives the canvas full width.

### Gateway detail (see gateway-detail-entry.html)

_"If the canvas is already the detail, where does the drawer open?"_

The gap the user caught: clicking a gateway in the sidebar opens its canvas (spatial detail). But where do Overview/Connect trigger? Solution = the **3-column shell**, the merge of two overlapping locks.

- **Left sidebar = PERSISTENT but toggleable** (app shell): GATEWAYS list (Slack-channel + live dot) · PROVIDERS · SYSTEM. It doesn't disappear inside a gateway: one-click switching between gateways. **macOS-native toggle** (`sidebar.left` icon at the header's left + `⌘\`): closing it gives the canvas full width (Xcode/Mail/Finder pattern, which also helps canvas crowding).
- **Canvas = the gateway's spatial detail.** **The canvas itself** shows live routing health (flowing green dot wires, round-robin shares, the failover ladder, down = red ✕).
- **Persistent top toolbar** (Mobbin: Squarespace editor's persistent top bar): start/stop capsule · address pill `http://localhost:8397/my-gateway · running` · `⋯` lifecycle menu. **The home of lifecycle** (the "toggle in the drawer header" gap from the A+B+C decision resolved here) + at-a-glance status. NO "‹ Gateways" back arrow: the sidebar already provides that list.
- **Click the Gateway ENDPOINT node → the Overview / Connect inspector** opens: part of the "every node opens its own inspector" rule (no new concept). ~~Logs as a third tab~~ **SUPERSEDED:** logs moved to the bottom panel.
- **Overview content = aggregate NUMBERS** (endpoint status, last-24h request/token/error/p95 KPIs, served-models shares): **A cards** won.
- **Overview option B (routing-health/target list) ELIMINATED** → the canvas already shows it live. Repeating it in the drawer would be a copy.

## Open design questions (filled during brainstorm)

- [x] Node creation / wiring interaction → A port-drag + C ⌘K
- [x] Main screens / surface list → Local Gateways / Providers / System (Usage · Settings). Templates: gateway, onboarding, gateway-detail, settings
- [x] Canvas node types → Gateway / Virtual Model / Router / Target
- [x] Onboarding / first launch → A checklist card + B ghost chain/coach mark (at the gateway step)
- [x] Design language / look & feel → **Mac Native, explorations 08/09 locked** (see the superseded style section)
- [x] Provider/account hookup screen → A catalog→right drawer, OAuth/key fork
- [x] Virtual model creation flow → A inline name + A1 post-↵ auto port-picker (target/router)
- [x] Node/wire live status language → C (wire color/flow + badge + failover story, fancy)
- [x] Expressing routing visually (failover/round-robin) → the user chooses the mode, the visual follows (ladder / shares)
- [x] Logs / monitoring → bottom panel only, selection-scoped (routing-centric, no separate page, no inspector tab)
- [x] Client export flow → A client-tab snippets (+ C auto configure planned, token line only when required)
- [x] Empty states, error states → A in-place/localized + B banner/toast (no takeovers, empty=onboarding)

## Backend (deferred, references)

- cliproxyapi, opencodex, ccproxy → translation + gateway logic adapted from these.
