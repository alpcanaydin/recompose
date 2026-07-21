# recompose — Design Document (UI/UX)

**Date:** 2026-07-21 (first version 2026-07-20; renamed from "rewire" and reconciled with the design system 2026-07-21)
**Status:** Design decisions locked · UI-first · pre-implementation · **Direction locked: Mac Native (explorations 08/09)**
**Canonical source (source of truth):** the **claude.ai/design** design-system project **"recompose-design-system"** (`design-system/library/` locally, namespace `Recompose_fe80a3`) — tokens, components, and the four screen templates. Explorations `08-mac-dark.html` / `09-mac-light.html` are the historical origin of the direction; where this document and the DS disagree, **the DS wins**. History: `BRAINSTORM-NOTES.md` + companion mockups (`.superpowers/brainstorm/96174-1784553006/content/*.html`).
**Next step:** interactive prototype built inside the same Claude Design project.

---

## 1. Product essence

**recompose — Universal Local AI Gateway Composer** (recompose.sh). Unifies fragmented AI accounts/providers (Claude, Codex, OpenRouter, Gemini, Kimi, DeepSeek, GLM, OpenAI/Anthropic-compatible endpoints, local models) into **local gateways** in one place. The user creates **virtual/custom models** on a **node-based visual canvas**, maps them to real provider models, and routes across accounts with **failover/round-robin**. Clients (Claude Code, Codex, Cursor) connect only to gateways and see only the virtual model names.

**Dual-protocol gateways (locked 2026-07-21):** every gateway always serves **both** the Anthropic and the OpenAI dialect on **one base URL** — the protocols disambiguate themselves by path (Anthropic clients POST `{base}/v1/messages`, OpenAI clients POST `{base}/v1/chat/completions`). `http://localhost:8397/my-gateway` is the single copyable address (`ANTHROPIC_BASE_URL=…/my-gateway`, `OPENAI_BASE_URL=…/my-gateway/v1`). Explicit protocol subpaths (`…/anthropic`, `…/openai`) were considered and rejected. There is no per-gateway "protocol type" setting.

**Thesis:** the essence is **orchestration/composition** (routing/pooling across accounts → beating rate limits), not a mere "gateway". Backend protocol translation is a solved commodity (opencodex/cliproxyapi/ccproxy) — adapted later.

**Principles:**
- Strictly **OSS**, no commercial intent.
- **UI-first**: the visual/UX is fully designed first; the backend is wired in afterwards.
- **Offline-first, no signup**: no accounts, no cloud. Clients connect via env vars (`ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL`, `OPENAI_BASE_URL`) or config files (`~/.claude/settings.json`).

---

## 2. Platform & technical direction

- **Shell: Electron 30+** (Bun = backend/sidecar: gateway engine + protocol translation). **Pivoted from Electrobun.** Trade-off: 80–150 MB bundle (acceptable for an OSS pro tool).
- Character: **DESKTOP-native, macOS-first, "Mac Native" flat pro tool** (TablePlus/Xcode flavor) — traffic lights top-left, flat dark/light chrome, systemBlue accent, SF feel. Not a web app.
  - **Direction change (2026-07-20):** the Liquid Glass-heavy character and alternatives 01–07 were **eliminated**; the direction is locked onto **explorations 08 (dark) / 09 (light)**.
  - **Vibrancy only in the sidebar:** body background is a mac wallpaper, sidebar is translucent blur (`backdrop-filter: blur(52px) saturate(150%)`, alpha `.82` dark / `.8` light — lower values were judged too transparent). The rest of the chrome is flat/opaque.
  - On the native side this corresponds to `NSVisualEffectView` sidebar vibrancy; no heavy CSS glass.
- **The window fills the viewport:** `.win` has a symmetric 28px margin, `.app` height is `calc(100vh - 58px)`, `min-height: 640px`. Browser fullscreen = a faithful app simulation; extra height is absorbed by the canvas, the minimap stays pinned bottom-right.
- Signature: **live green flowing dots** on the wires (real-time traffic); the status language extends to the sidebar dots.

---

## 3. Information architecture (IA) & app shell

Three-column shell:

```
┌────────────┬────────────────────────────────┬──────────────┐
│  SIDEBAR   │  CANVAS (top toolbar + canvas   │  NODE DRAWER │
│ (persistent│   + bottom status bar           │  (when a     │
│  ⌘\ toggle)│   + bottom log panel, toggled)  │   node is    │
│            │                                 │   selected)  │
└────────────┴────────────────────────────────┴──────────────┘
```

### 3.1 Left sidebar (persistent, toggled with `⌘\`)

HIG source-list language (28px rows / 13px text / 16px symbols, no search). Taxonomy (Mobbin: Cursor, Relevance AI):

- **Local Gateways** (the name "Virtual Gateways" was eliminated) — rows are `name` + live status dot (🟢 pulse = traffic · ⚪️ = idle · 🟡 = rate-limit/failover · 🔴 = stopped/error).
- **Providers** — children: **Subscriptions / API Keys / Aggregators** + count badges (the name "Accounts" was eliminated).
- **System** — **Usage** and **Settings**.

**Gateway rows are never branded (locked 2026-07-21):** every gateway row uses the neutral **`net` icon in teal** (the gateway tint) — not Claude/OpenAI marks. Brand marks (real logos, never hand-drawn: Claude = brand-orange sunburst, OpenAI = monochrome knot following the foreground) appear **only on provider surfaces** (connect-provider sheet, provider nav, iconography card).

**Icons are multi-color** (no white-out on selection): gateways teal, Subscriptions blue, API Keys yellow, Aggregators purple, Usage green, Settings orange.

**Selection state is monochrome (macOS 26 / Liquid Glass direction):** instead of a blue accent, a neutral semi-transparent gray fill (`rgba(255,255,255,.11)` dark · `rgba(0,0,0,.075)` light) + `font-weight: 500` for emphasis. Icons keep their own colors — no color override on selection. Reference (Mobbin): Microsoft Copilot, Obvious, Rox, DoorDash Dasher.

### 3.2 Top toolbar (Xcode-style)

Replaces the old `name · :port · ● running` header:

- **Left capsule:** start/stop toggle (red stop square ↔ green play) + **book-icon connect-help** (connection instructions) + **`⋯` lifecycle menu** (Rename · Duplicate · Delete…).
- **Center:** the **address-bar pill** — a small teal `net` glyph + the gateway address in mono: `http://localhost:8397/my-gateway — running` (flex: 1). No brand mark in the pill (see §3.1). Reference: Firecrawl.
- **Right:** bg-filled **auto-tidy** (wand+sparkle) + **Edit-as-JSON `{}`** buttons + the panel-toggle capsule (**panel-b** = bottom log panel · **panel-r** = right inspector).

The run toggle is **stateful**: stopping hides the flows, extinguishes the live pins, stops the log stream, and the pill reads "— stopped".

### 3.3 Bottom status bar (VS Code-style)

The Canvas/Logs/Config tabs were eliminated; the log panel opens from the toolbar panel toggle. Reference: GitHub Codespaces, Replit, Weavy.

- **Left:** live metrics — `42 req/min · p95 1.1s · 3 errors · 3 clients | 18.2k tok/min · $0.42 this hr`. **The tok/min·$ chip is clickable → opens the Usage drawer.**
- **Right (after a flex spacer):** canvas status — `8 nodes · 7 wires`.

### 3.4 Canvas, drawer & bottom log panel

- **The canvas is the gateway's spatial detail.** Click a gateway in the sidebar → that gateway's canvas opens.
- **Right node drawer:** clicking any node opens its own inspector (consistent across all node types). The drawer header shows the node name + type; the **Basics** group holds Display name + Slug + Routing mode (models have both a display name and a slug).
- **Bottom log panel:** toggled by the toolbar `panel-b` button; full-width, 190px tall, scoped to the current selection. The canvas pans up (−72px) while it is open. See §7.

---

## 4. Canvas & routing composition

### 4.1 The chain (the heart)
```
Gateway (endpoint) → Virtual Model → [Router (optional)] → Target (Account · real model)
```
- A gateway serves **multiple Virtual Models** — the canonical screen shows **3 VMs** (`creative`, `fast`, `code`) fanning out from the Gateway node. Reference: Writer (closest), OpenAI Agent Builder, Runway.
- **Only the SELECTED VM expands its full chain** (Router → Targets); unselected VMs **collapse to a stub wire + chip** ("▸ 2 targets" / moon-icon "1 target"). Selected-node emphasis is strong: 2px colored border + double-ring glow.
- **Router** is an explicit, optional, chainable node. **Each router is single-mode**, carrying a **mode pill** (`⇄ round-robin` / `↓ failover`). The failover visual = **numbered slots (#1/#2) + a dashed "standby" wire** (Calendly + Cal.com). Nested / multi-mode = chain routers. Targets are always separate "Account·model" cards.
- **Weight % chips live ONLY in the inspector target list** (with status dots), never on the canvas.
- **Color coding (full-tint node borders):** Gateway **teal** `#40c8e0` · Virtual Model blue `#0a84ff` · Router orange `#ff9f0a` · Target purple `#bf5af2`. (The old gray gateway was eliminated.) Other tokens: green `#32d74b`, red `#ff453a`, yellow `#ffd60a`; light-theme equivalents live in the DS tokens (`#007aff`, `#28cd41`, teal light `#30b0c7`…).

### 4.2 Building nodes / wiring
- **Primary:** drag from a port → on release, a "what should I connect?" menu (n8n logic).
- **Power user:** **⌘K** command palette to search-insert nodes.
- NO left palette.

### 4.3 Node/wire status language (Mobbin: n8n, Retool)
- **Healthy:** green flowing dots.
- **High latency:** yellow slow dots + clock chip (`⏱ 2.8s`).
- **Error:** flat red wire (no flow) + a white ✕ pill badge at the midpoint.
- **Idle:** orange dashed static + moon-icon "idle" chip.
- On rate-limit, traffic shifts to the failover target; the failover story is visual.

### 4.4 Crowding / scale
The graph is fixed-layered (Gateway·VM·[Router]·Target). Crowding comes from parallel VM count.
- **Baseline = free drag** (manual positioning).
- **Zoom cluster (− 100% + expand) bottom-left of the canvas**, **minimap bottom-right** (moving zoom into the status bar was tried and reverted).
- **Tidy:** the toolbar auto-tidy button → automatic layered layout (dagre), one click (scatter-and-spring animation).
- **Collapsible VMs:** the selected-VM-expands pattern of §4.1 is itself the scale solution.
- Plus: the sidebar toggle (`⌘\`) gives the canvas full width.

---

## 5. Node inspectors & gateway drawer

### 5.1 Gateway node → **Overview / Connect** (two tabs only — the Logs tab was eliminated 2026-07-21; logs live in the bottom panel, §7). Template: `templates/gateway-detail/`.
- **Overview = aggregate NUMBERS** (the canvas already shows live routing health, so the target list is NOT repeated):
  - **Endpoint** box: Base URL `http://localhost:8397/my-gateway` + Status `Running · 3d 4h`.
  - **Last 24h** 2×2 KPI grid: `12.4k requests · 8.2M tokens · 0.3% errors · 1.1s p95`.
  - **Serves · 3 models**: share bars per VM — creative 54% (blue) / fast 31% (green) / code 15% (purple).
  - Decision: **A KPI cards** won; B (routing-health list) eliminated. Reference: Cloudflare Workers, WRITER Observability, Laravel Cloud.
- **Connect** = client hookup (§6 below).

### 5.2 Virtual Model inspector (solved on the canonical screen)
- **Basics:** Display name · Slug · Routing mode (Round-robin/Failover segmented).
- **Targets · N:** each row avatar + `account · model` + subline `provider · status` + status dot + **% weight**. A failing row carries an inline **"Reconnect" chip** (red pill — the inline action of §8.2.3). "+ Add target…" below.
- **Usage block:** **Session** quota bar (`62% · resets 6:00 PM`) + **Weekly** quota bar (`41% · resets Mon 9:00 AM`) + a **"View detailed usage"** link → opens the Usage drawer model-scoped (without highlighting the sidebar Usage item). Quota/reset pattern (Mobbin): Glide (closest), StackAI, Vercel, LangChain.

### 5.3 Other node inspectors
- Router and Target nodes → their own right drawers (name, mapping, mode, account/model selection, etc.).

### 5.4 Usage drawer (usage lives in three places)
1. **Sidebar → System → Usage** and 2. **the status-bar tok/min·$ chip** → open the right **Usage drawer** (replacing the inspector): green gauge header · last-24h spend chart · 2×2 activity KPI grid · per-provider bars · scope subtitle (`#usgscope` — All gateways / model-scoped).
3. **The Usage block in the VM inspector** (§5.2) opens the same drawer model-scoped.
Reference: OpenAI Platform.

---

## 6. Connecting providers & connecting clients

- **Provider hookup:** catalog → **OAuth / API-key** fork in a right drawer. Providers is a top-level surface (Subscriptions / API Keys / Aggregators). Brand marks (real logos) appear here.
- **Client hookup (Connect tab):** in the gateway inspector — one **Base URL** box (`· serves both dialects`) with Copy, then **"Point a client here"** mini-tabs **Claude Code / OpenAI / cURL**, each with a ready snippet + Copy:
  ```
  # route Claude Code to recompose
  ANTHROPIC_BASE_URL=http://localhost:8397/my-gateway
  ANTHROPIC_MODEL=creative
  ```
  **No API key appears by default** (§8.4). When Settings has "Require API token" ON, the Connect tab grows an **"API token · required by Settings"** box (`rc-local-••••••••3f9a` + Copy) and the snippet gains `ANTHROPIC_AUTH_TOKEN=rc-local-…3f9a` (DS screen "Connect · Token required").
  The toolbar book-icon connect-help opens this same tab. Reference inspiration: Linear Preferences "Coding tools".
- **Auto-configure** (detect a local client and write its config file, with Undo) remains a planned accent — not yet in the DS template.
- VM creation: inline naming (display name + auto slug).

---

## 7. Logs / monitoring — the bottom panel (locked 2026-07-21)

There is NO separate top-level Logs page **and NO Logs tab in the inspector** — "the bottom bar shows the selection's logs". The log stream lives in a **full-width bottom panel** (190px), toggled by the toolbar `panel-b` button, **scoped to the current selection** (e.g. `Logs · My Gateway`). Template: `templates/gateway-detail/` screen 4.

- **Header:** `Logs` + mono scope label + live dot + filter chips (`All` / `Errors` / per-VM: `creative` `fast` `code`) + ✕ close.
- **Rows** (dense mono, routing-centric): `14:22:09 POST creative → sonnet | anthropic · work | 200 | 0.9s` — including 429 (warn) and 500 (error) rows and a `via openrouter` upstream column.
- The canvas stays visible above (pans up −72px) with wires still flowing — the observable extension of the live-traffic signature.
- Stopping the gateway stops the stream (stateful run toggle, §3.2).
- The old drawer-tab option (A) was eliminated; the dock form (B) won. Reference (Mobbin): Stripe Logs, Supabase, Base44, Vercel Live tail.

---

## 8. Lifecycle, error states, empty states

### 8.0 Port model — **single port + path-per-gateway**
One server port (**:8397**); each gateway is a URL path (`http://localhost:8397/my-gateway`). The gateway node subtitle is `/my-gateway · :8397`. A per-gateway custom port override is **deferred to an advanced gateway setting**. (The old port-per-gateway model and the "port +1" duplicate behavior were eliminated.)

### 8.1 Gateway lifecycle — A+B+C all (companion: `gateway-lifecycle.html`)
- **Sidebar (speed):** the status dot is a one-click start/stop toggle; hover `⋯` (right-click same) → Start/Stop · Rename · Duplicate · Delete. Rename also via double-click inline.
- **Toolbar (authority):** the left-capsule start/stop toggle + the **`⋯` menu** (Rename · Duplicate · Delete…) — present on the canonical screen.
- **Duplicate:** clones the config, appends "-copy" to the name (new path on the same port) → shareable-template feel.
- **Destructive actions ask for confirmation** (modal: "connected clients will lose this endpoint · cannot be undone").
- Reference: Coda, Toggl, Lemni.

### 8.2 Error states (companion: `error-states.html`) — A in-place + B banner/toast
NO full-page takeover (Buffer/VEED/Monarch anti-pattern). Taxonomy:
1. **Node/wire (routing)** — 429/500/target down → the wire/badge language (§4.3) + failover.
2. **App-level** — port taken, OAuth exhausted, offline → **banner/toast** + inline action (Change port / Reconnect).
3. **Provider/account** — auth expired, invalid key → row badge + **inline "Reconnect" chip** (on the canonical screen: the failing row in the inspector target list) + drawer "Reconnect".
4. **Catastrophic crash** (rare) → full-screen fallback (the single exception).
- **C (a separate health center) was eliminated** — the sidebar dots + canvas status language already aggregate health.
- Reference (right direction): Better Stack, Google Meet inline instructions.

### 8.3 Empty states
- Solved in onboarding: empty canvas + **checklist + ghost chain**. Other gaps (no providers → "Connect" CTA, no logs → "Waiting for the first request") use the same quiet inline language.

### 8.4 Local auth & network exposure (locked 2026-07-21 — LM Studio model)
Research-driven (Ollama's no-auth stance + CVE-2024-28224 DNS rebinding; LM Studio's flat token toggle). Three layers:
1. **No API key in the default UI** — localhost use needs zero ceremony.
2. **Invisible engine hardening:** the gateway validates Origin/Host headers against DNS rebinding (the Ollama CVE fix pattern). Spec text only; no UI.
3. **One flat, always-visible switch:** Settings › Server › **"Require API token"**, OFF by default ("Clients must send it as a Bearer token · recommended when serving on LAN"). ON reveals the token row (§9) and grows the Connect tab (§6). Unlike Ollama, recompose fronts **paid accounts** — LAN exposure without a token would mean quota theft, hence the toggle exists.
The contextual-key idea (key auto-required only when bind = LAN) was rejected as too hard to explain.

---

## 9. Settings — single-column grouped page (template: `templates/settings/`)

The main sidebar "Settings" surface → a **single scrollable grouped page** in the content area (macOS grouped-card language, 560px column). **`⌘,`** focuses this surface, no separate window. C (a separate Preferences window) was eliminated; if content grows, promoting to A (category rail) is easy. Reference (Mobbin): Substack/Vercel row anatomy, Google Drive Settings, Linear Preferences, macOS System Settings.

Groups (as in the DS template — source of truth):
- **General:** Launch at login · Show in menu bar · Start gateways on launch.
- **Server:** Default port (`8397` — single port, §8.0) · Bind address (segmented: Localhost only / LAN) · **Require API token** (switch, §8.4) → when ON, reveals the **API token** row: mono `rc-local-••••••••3f9a` + Copy + Regenerate.
- **Appearance:** Theme (System/Light/Dark segmented) · **Reduce wire motion** (the signature flowing-dot effect; low-power mode).
- **Data:** Config folder `~/.recompose` + "Reveal in Finder" · Keep request logs (24h / 7 days / 30 days) · Telemetry: "None — recompose never phones home" (offline-first, stated explicitly).

Deferred (decided earlier but not in DS template v1): accent-color picker, config export/import, auto-update group, request-timeout default, per-gateway port override.

---

## 10. Mockup index

**Canonical (source of truth):** the Claude Design project **recompose-design-system** (`design-system/library/`):
- **Templates (screens):** `templates/gateway/` (full canvas composition) · `templates/onboarding/` (3 beats: checklist+ghost graph, create-gateway sheet, connect-provider sheet) · `templates/gateway-detail/` (4 screens: Overview, Connect, Connect·Token required, Logs panel) · `templates/settings/`.
- **Cards:** node cards · wire states · controls · colors/materials · type/spacing · iconography · app shell · inspector & usage drawer.

**History (direction origin):** `design-system/explorations/08-mac-dark.html` + `09-mac-light.html` (alternatives 01–07 eliminated; kept as skin variants, not directions).

**History (decision source):** `.superpowers/brainstorm/96174-1784553006/content/` — `logs.html` · `error-states.html` · `gateway-lifecycle.html` · `gateway-overview.html` · `gateway-detail-entry.html` · `canvas-scale.html` · `settings.html` · `router-modes.html` (+ earlier-session mockups: onboarding, client-connect, node/wire states, etc.).

---

## 11. Open items (handoff to implementation)

**Screens/states not yet mocked** (decisions are in this document, visuals pending — natural prototype-phase work):
- Failover visual language on the canvas (#1/#2 slots + dashed standby wire, §4.1).
- ⌘K command palette + the drag-from-port connect menu (§4.2).
- Provider catalog + the OAuth/API-key drawer (§6) — the onboarding connect sheet covers the entry beat only.
- Delete confirmation modal + app-level banners/toasts (§8.1–8.2).
- Auto-configure for detected clients (§6).
- Router / Target node inspectors as full screens (§5.3 — the component language exists in the DS).

**Done since the first version:** gateway inspector Overview + Connect (incl. token variant) · bottom Logs panel · Settings page · onboarding (3 beats) · dual-protocol decision · local-auth model.

**Other:**
- Backend protocol translation (adapting opencodex/cliproxyapi/ccproxy) — after the UI locks.
- ~~Electrobun maturity validation~~ **DECIDED: pivoted to Electron** (see §2).
- ~~Router multi-mode visual language~~ **CLOSED (A):** single-mode routers + chaining (§4.1).

> Note: this repo is not git (`git: false`). The "commit" step does not apply; the document lives as a file.
