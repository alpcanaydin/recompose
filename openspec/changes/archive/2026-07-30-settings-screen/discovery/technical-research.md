## Discovery brief: settings-screen (tier full)

Scope read first: `openspec/changes/settings-screen/proposal.md` and `openspec/changes/settings-screen/specs/settings/spec.md`, plus the code the change touches: `packages/contracts/src/{settings,ipc,migration,accounts}.ts`, `apps/desktop/src/main/index.ts`, `apps/desktop/src/main/ipc/storage-ipc.ts`, `apps/desktop/src/main/storage/{settings-store,vault}.ts`, `apps/desktop/src/preload/index.ts`, `apps/desktop/src/renderer/src/app/routes/__root.tsx`, `apps/desktop/electron-builder.yml`, and ADRs 0009, 0010, 0016, 0017, 0028.

Stack facts that constrain every recommendation below: Electron 43.2.0, React 19.2.8, Tailwind 4.3.3, TypeScript 7.0.2, zod 4.4.3, Storybook 10.5.4 with `@storybook/addon-a11y`, Playwright 1.61.1 + `electron-playwright-helpers`. Linux ships as AppImage and deb only (`apps/desktop/electron-builder.yml` lines 27-33). There is no `shared/ui` segment yet: `apps/desktop/src/renderer/src/shared/api/index.ts` exports only `ipc-result`, and `.../shared/ui/index.ts` does not exist. The proposal's "first shared component layer" is literally true.

---

### 1. Headless primitive library: recommend Base UI

The four primitives (switch, segmented control, numeric field, grouped row) are the deciding constraint, and the numeric field eliminates most candidates.

| Library                    | Latest | Switch | Radio group | Number field            | Field/label wiring   |
| -------------------------- | ------ | ------ | ----------- | ----------------------- | -------------------- |
| Base UI (`@base-ui/react`) | 1.6.0  | yes    | yes         | **yes**                 | `Field` + `Fieldset` |
| Radix (`radix-ui`)         | 1.6.7  | yes    | yes         | **no** (docs page 404s) | `Label` only         |
| React Aria Components      | 1.19.0 | yes    | yes         | yes                     | `Label`/`Text` slots |
| Ark UI (`@ark-ui/react`)   | 5.37.2 | yes    | yes         | yes                     | `Field`              |

Radix has no number-field primitive at all: https://www.radix-ui.com/primitives/docs/components/number-field returns 404, and the component nav on the ToggleGroup page lists none. Choosing Radix means hand-rolling the spinbutton, which is the single hardest primitive of the four to get right.

Base UI is the recommendation:

- **It is stable and recently so.** v1.0.0 shipped 2025-12-11 ([release](https://github.com/mui/base-ui/releases/tag/v1.0.0), [InfoQ writeup](https://infoq.com/news/2026/02/baseui-v1-accessible/)); the registry currently lists 1.6.0 with peer range `^17 || ^18 || ^19`, so React 19.2.8 is in range.
- **Its Switch does the right thing.** `SwitchRoot.tsx` sets `role: 'switch'` and `'aria-checked': checked` directly ([source](https://raw.githubusercontent.com/mui/base-ui/master/packages/react/src/switch/root/SwitchRoot.tsx)), which is exactly what the [APG Switch pattern](https://www.w3.org/WAI/ARIA/apg/patterns/switch/) requires. Radix also claims APG switch adherence ([docs](https://www.radix-ui.com/primitives/docs/components/switch)), so this is a tie, not a differentiator.
- **Its NumberField input is `type="text"` with a configurable `inputMode`**, not `type="number"` ([source](https://raw.githubusercontent.com/mui/base-ui/master/packages/react/src/number-field/input/NumberFieldInput.tsx)). See finding 3 for why that matters.
- **`Field` + `Fieldset` give the grouped row its accessibility for free.** The grouped row is label + description + control with `aria-describedby` wiring and a `group`/`fieldset` around related switches, which is precisely what the [APG Switch pattern's grouping guidance](https://www.w3.org/WAI/ARIA/apg/patterns/switch/) calls for.
- **It has a first-class CSP story.** ADR-0028 drops `'unsafe-inline'` from `style-src` in production. Base UI documents exactly which components inject inline styles (`ScrollArea.Viewport`, and `Select.Popup`/`Select.List` under `alignItemWithTrigger`) and ships a [CSP Provider](https://base-ui.com/react/utils/csp-provider) for nonces. None of the four primitives this feature needs are on that list, so the current CSP should hold, but the escape hatch exists if a later component needs it.

Trade-offs against the alternatives, stated honestly:

- **React Aria Components** is the most accessibility-rigorous option and its [NumberField](https://react-aria.adobe.com/NumberField) has the deepest i18n (locale numbering systems, `Intl.NumberFormat`). Its peer range `^16.8.0 || ^17.0.0-rc.1 || ^18.0.0 || ^19.0.0-rc.1` covers React 19 ([package.json](https://raw.githubusercontent.com/adobe/react-spectrum/main/packages/react-aria-components/package.json)). The cost is a heavier, more opinionated render/style contract that fits Tailwind less naturally than Base UI's `render` prop and `data-*` state attributes. For a single-Chromium Electron target with a bespoke two-tier token system (ADR-0009), that extra machinery buys little.
- **Ark UI** matches Base UI on component coverage and adds a Zag.js state-machine layer. Its multi-framework parity is a benefit this repo cannot use (React only), so it is added surface for nothing.
- **Radix** is the incumbent-by-reputation choice, but the missing number field is disqualifying for this specific feature set.

Residual risk to close in implementation: Base UI's NumberField docs advertise `aria-roledescription="Number field"` but do not document a `role="spinbutton"`. I could not confirm the exposed role from the docs. Verify it with the `@storybook/addon-a11y` axe run before accepting the primitive, and compare against the [APG Spinbutton pattern](https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/) (`aria-valuenow`/`valuemin`/`valuemax`, Up/Down arrows, Home/End).

### 2. The segmented control must be a radio group, not a toggle group

This is the finding most likely to be gotten wrong. A segmented control that picks one of N mutually exclusive values (theme: system/light/dark) is semantically a radio group.

Radix's `ToggleGroup type="single"` exposes `role="group"` with `aria-pressed` buttons, not `role="radiogroup"` with `role="radio"` children. That was filed as [radix-ui/primitives#3188](https://github.com/radix-ui/primitives/issues/3188) with PR #3189; the issue now reads closed, but I could not confirm from the page whether the fix shipped in `radix-ui@1.6.7`, so treat it as unverified.

Build the segmented control on the **Radio Group** primitive regardless of library. The [APG Radio Group pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/) specifies `radiogroup` + `radio`, `aria-checked`, and arrow keys that move focus _and_ change selection (a single tab stop via roving tabindex). Radix's ToggleGroup, by contrast, makes every item its own tab stop. Base UI's `Radio` renders a `<span>` plus a hidden `<input>` for form semantics ([docs](https://base-ui.com/react/components/radio)). The segmented look is then purely a styling concern over correct radio semantics.

### 3. The port field: `type="text" inputmode="numeric"`, not `type="number"`

The GOV.UK Design System team moved off `input type="number"` after user research ([Technology in Government blog, 2020-02-24](https://technology.blog.gov.uk/2020/02/24/why-the-gov-uk-design-system-team-changed-the-input-type-for-numbers/)). Their documented failures: Dragon NaturallySpeaking cannot dictate into it; NVDA lists it unlabeled; browsers silently discard non-numeric keystrokes with no feedback; scroll-wheel-over-field silently mutates the value; large numbers get converted to exponential notation on arrow-key press. Their replacement is `<input type="text" inputmode="numeric" pattern="[0-9]*">`.

Base UI's NumberField already renders `type="text"` with a context-configurable `inputMode`, which is this recommendation implemented upstream. That is the strongest single argument for Base UI over hand-rolling.

Range: the spec's 1024-65535 spans two IANA ranges. [RFC 6335 §6](https://www.rfc-editor.org/rfc/rfc6335.html) defines System Ports 0-1023, User Ports 1024-49151 (IANA-assigned), Dynamic/Private 49152-65535 (never assigned). The current default `enginePort: 8397` sits in the User range. The existing schema (`packages/contracts/src/settings.ts`, `z.int().min(1024).max(65535)`) already encodes this correctly; the field copy should state the range, per the spec's own scenario.

### 4. Instant apply is a documented standard, and it has a documented exception for text fields

The spec's "a change MUST persist without a save action" is the industry-standard preferences pattern, not a novel choice. The canonical statement is [GNOME HIG 2.2.1, §3.3.1 "Instant apply windows"](https://p.janouch.name/files/gnome-hig-2.2.1/): do not make the user press OK or Apply unless the change takes more than about one second to apply, or several changes must be applied simultaneously to avoid an unstable intermediate state.

The same source carries the exception that matters for the port field: **do not validate or apply a text field's change until focus leaves the control or the window closes**, because validating on each keypress is hostile. Applied here: switches and the segmented control commit on change; the port field commits on blur (or Enter), and an out-of-range value keeps the stored port and surfaces the range, exactly as the spec's second scenario describes. Do not debounce-on-keystroke; commit on blur.

Current GNOME HIG confirms the switch-over-checkbox preference for these rows: switches "are preferred to checkboxes, since they offer a larger click target, often fit modern UI layouts better, and are more action orientated" ([GNOME HIG, Switches](https://developer.gnome.org/hig/patterns/controls/switches.html)).

### 5. Launch at login: Electron covers macOS and Windows; Linux is a "wontfix" you must implement

`app.setLoginItemSettings()` / `app.getLoginItemSettings()` are **macOS and Windows only** ([Electron app docs](https://www.electronjs.org/docs/latest/api/app)). The Linux feature request [electron/electron#15198](https://github.com/electron/electron/issues/15198) is closed with a `status/wontfix` label. Since the repo targets all three platforms, this is a genuine gap, not a doc nuance.

What the Electron API gives you that the spec asks for: `getLoginItemSettings().openAtLogin` is read from the OS, which satisfies the spec's "the switch MUST report what the operating system holds" requirement directly, on two of three platforms. Notable options: `type`/`serviceName` (macOS 13+ SMAppService), `enabled` and `launchItems` (Windows registry), and the deprecated `openAsHidden` (macOS 13+).

For Linux, the standard is the [XDG Desktop Application Autostart Specification v0.5](http://specifications.freedesktop.org/autostart/latest/): a `.desktop` file in `$XDG_CONFIG_HOME/autostart` (defaulting to `~/.config/autostart/`), with `Hidden=true` as the per-user disable mechanism. Reading state = does that file exist and is it not `Hidden=true`.

The off-the-shelf option is [`Teamwork/node-auto-launch`](https://github.com/Teamwork/node-auto-launch), which does write `~/.config/autostart/*.desktop`. **I do not recommend taking it**, and the evidence is specific rather than vibes:

- Latest stable `auto-launch@5.0.6` published 2023-05-18; a `6.0.0-rc1` sat unreleased since 2024-02-27 (npm registry). Most recent commit in the repo feed: 2024-04-09.
- It has known Electron path bugs on exactly this repo's Linux targets: [issue #48](https://github.com/Teamwork/node-auto-launch/issues/48) ("Autolaunch in linux launches electron executable - not the electron app") and [issue #85](https://github.com/Teamwork/node-auto-launch/issues/85). It guesses the path from `process.execPath`, which for an AppImage is wrong; the correct value is `process.env.APPIMAGE`.

This satisfies the CLAUDE.md "search before build" rule: the off-the-shelf answer exists, was evaluated, and is unmaintained and known-broken for AppImage. The Linux implementation is a pure `.desktop` file renderer plus one file write and one file read, ~40 lines against a published spec, fully unit-testable with an injected filesystem, and it fits the repo's existing single-writer-in-main storage discipline. Record the rejection in the ADR.

### 6. Menu bar tray: three caveats, all documented

- **Hold a module-scope reference.** The [Tray tutorial](https://www.electronjs.org/docs/latest/tutorial/tray) says to "save a reference to the Tray object globally to avoid garbage collection." A tray created inside an IPC handler and not stored will vanish.
- **The tray changes the quit contract.** `apps/desktop/src/main/index.ts` lines 82-86 currently quit on `window-all-closed` for non-darwin. The spec requires the app to survive last-window-close while the tray shows. The [app docs](https://www.electronjs.org/docs/latest/api/app) state that if you listen to `window-all-closed` you control whether the app quits, and that the event does **not** fire on Cmd+Q or `app.quit()`. So the handler becomes conditional on tray presence. Corollary the spec does not state: with the tray on, the tray context menu becomes the only quit affordance on Windows/Linux, so it must carry an explicit Quit item.
- **Platform differences are real.** Per the [Tray API docs](https://www.electronjs.org/docs/latest/api/tray): macOS needs Template images (filenames ending `Template`, with matching `@2x`), 16x16 and 32x32@2x; Windows prefers `.ico`; on Linux, activation may be single or double click depending on desktop environment, and mutating a `MenuItem` requires calling `setContextMenu()` again. `right-click`/`double-click` are Windows+macOS only.

### 7. "Reveal the config folder": use `shell.openPath`, not `showItemInFolder`

The proposal says "a call that reveals a folder in Finder", but the spec scenario says "the operating system file browser opens **at** that folder". Those are two different Electron calls ([shell docs](https://www.electronjs.org/docs/latest/api/shell)):

- `shell.showItemInFolder(fullPath)` shows the given item _in its parent_ file-manager window and selects it. Synchronous, no return value, so a failure is silent.
- `shell.openPath(path)` opens the path in the desktop's default manner and returns `Promise<string>` that resolves to an error message on failure, empty string on success.

`openPath` matches the spec's wording and, critically, gives you a failure signal, which the clean-code rule against silent failures demands. Recommend `openPath(app.getPath('userData'))` with the resolved error string mapped into the existing `IpcError` envelope.

### 8. Theme: one main-process call does the whole job

ADR-0009 committed to `:root { color-scheme: light dark }` plus `light-dark()`, "zero JS and zero IPC", and explicitly noted a manual override is "one added line (`color-scheme: dark` on root)".

The cheaper path is the main process. `nativeTheme.themeSource` takes exactly `'system' | 'light' | 'dark'`, the same three values already in `settingsSchema.theme`. Setting it makes CSS `prefers-color-scheme` match in the renderer, and it also restyles Electron's own chrome: menus, context menus, DevTools ([nativeTheme docs](https://www.electronjs.org/docs/latest/api/native-theme)). Because `color-scheme: light dark` resolves the used scheme from the user preference, and `light-dark()` resolves from the used color scheme ([MDN `color-scheme`, updated 2026-07-21](https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme)), setting `themeSource` in main flips every semantic token with zero renderer CSS change.

Two things the docs make explicit and are worth planning around: `themeSource` is **not** persisted across launches (the settings document is the persistence), and the module emits an `'updated'` event when the underlying theme changes.

### 9. Gateway token: entropy standard, encoding, and where the guidance actually lives

- **RFC 6750 is the wrong source for entropy.** It says outright that "this document does not specify the encoding or the contents of the token" ([RFC 6750](https://www.rfc-editor.org/rfc/rfc6750.html)). It does fix the wire format (`Authorization: Bearer <b64token>`) and mandates TLS, which a `http://localhost` gateway cannot satisfy. That deviation is defensible for a loopback listener but belongs in the ADR rather than going unmentioned.
- **The citable entropy requirement is OWASP.** The [Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) sets a floor of 64 bits of entropy and recommends a CSPRNG "with a size of at least 128 bits".
- **Node gives you both pieces.** `crypto.randomBytes(size)` is a CSPRNG ([Node crypto docs](https://nodejs.org/api/crypto.html)), and `Buffer.toString('base64url')` produces unpadded RFC 4648 §5 output, available since Node 15.7.0/14.18.0 ([Node buffer docs](https://nodejs.org/api/buffer.html)). `randomBytes(32).toString('base64url')` yields 256 bits in 43 URL-safe characters, comfortably past the OWASP floor and inside RFC 6750's `b64token` grammar.
- **The vault already fits.** `apps/desktop/src/main/storage/vault.ts` exposes pure `setSecret`/`getSecret`/`deleteSecret` over `VaultDocument`, and `apps/desktop/src/main/ipc/storage-ipc.ts` already demonstrates the mint-ref-then-`setSecret`-then-`saveVaultFile` sequence for accounts (lines 141-153). The token channel is the same shape with a fixed `credentialRef` instead of a minted one. The spec's "turning the requirement off MUST NOT destroy the token" falls out naturally: the settings flag and the vault entry are independent writes. Note the existing precondition guard at line 130: `connectAccount` refuses with `vault-unavailable` when `safeStorage.isEncryptionAvailable()` is false. Mirror it, and surface the Linux `basic_text` plaintext-fallback flag ADR-0016 already requires be "a visible warning, not hidden" ([safeStorage docs](https://www.electronjs.org/docs/latest/api/safe-storage) for `getSelectedStorageBackend`, which returns `unknown` before app-ready).

### 10. Copying the token will hit the deny-by-default permission handler

This is the highest-value gotcha in the brief. `registerPermissionHandlers` in `apps/desktop/src/main/index.ts` (lines 19-33) denies every permission unconditionally, both request and check. Electron's [session docs](https://www.electronjs.org/docs/latest/api/session) list `clipboard-sanitized-write` among the permissions both handlers receive. A renderer calling `navigator.clipboard.writeText(token)` therefore goes through a handler that returns `false`.

Recommendation: do not use the Web Clipboard API. Add a channel that copies through Electron's main-process `clipboard` module. That keeps ADR-0028's "a future need becomes a visible, reviewable allowlist entry instead of a silent grant" intact without widening the permission surface at all, and it keeps the plaintext token from ever crossing into the renderer, which is consistent with the spec's "the screen MUST show a masked token".

Caveat on my confidence: I did not run this. Chromium auto-grants `clipboard-sanitized-write` to a focused document in many cases, and I could not find an authoritative statement of whether Electron consults the check handler on that path. Treat "it is blocked" as the likely case that the main-process route sidesteps entirely, and verify empirically if you want the Web API instead.

For the masked-then-reveal interaction, the closest prior art is Radix's `unstable_PasswordToggleField` ([docs](https://www.radix-ui.com/primitives/docs/components/password-toggle-field)), still marked unstable. Its documented behaviours are worth copying even if the component is not: return focus to the input when toggling by pointer, keep focus on the button when toggling by keyboard, and reset visibility to hidden after submission.

### 11. "Unavailable" rows: `aria-disabled`, not `disabled`, plus a named reason

The spec requires the four deferred rows to "render as unavailable and MUST name what it waits for". Two sources converge on the same implementation.

- [Jakob Nielsen, "Inactive GUI Controls: Show, Disable, or Hide?" (2025-11-13)](https://www.uxtigers.com/post/inactive-buttons) recommends showing the control in muted colors "supplemented by an explanation of why the feature is unavailable", preserving discoverability and avoiding layout shift. His caveat cuts the other way for permanently-unavailable features, which should be hidden; these four are temporarily unavailable, so showing them is the right call.
- [MDN `aria-disabled` (updated 2025-11-06)](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-disabled) is explicit that `aria-disabled="true"` keeps the element in the tab order while `disabled` removes it, and names "important submit buttons whose action is temporarily unavailable" as a target case. It also warns that with `aria-disabled` you must suppress the interaction and style the state yourself.

So: `aria-disabled="true"` on the control, the waiting-on reason in visible text wired via `aria-describedby` (Base UI's `Field.Description` does this), interaction suppressed in code. A keyboard user reaches the row, hears the reason, and cannot change it. Note MDN's forced-colors guidance (`GrayText`) for the disabled styling, which the two-tier token system will need a semantic token for, per ADR-0009's own "add the semantic line rather than reach for a primitive" rule.

### 12. Schema v1 to v2: the machinery already exists, but one ADR premise is stale

`packages/contracts/src/migration.ts` already implements a stepwise chain keyed on `from`, with a loop that re-reads `schemaVersion` after each step and refuses documents newer than supported. `settingsMigrations` is currently an empty array (`settings.ts` line 15) and `accounts.ts` shows the identical shape. Bumping `SETTINGS_VERSION` to 2 and pushing one `{ from: 1, migrate }` entry is the whole mechanism. No external library is warranted, and `fast-check` round-trip properties over the migration are already the house pattern per ADR-0016.

**Source conflict to report rather than act on.** ADR-0016 justifies the hand-rolled store with "electron-store has gone unmaintained" and repeats it in Alternatives. That is not accurate today: `electron-store@11.0.2` was published 2025-10-05, the [repository](https://github.com/sindresorhus/electron-store) is neither archived nor carrying a deprecation notice, and npm does not flag it deprecated. This does **not** change the recommendation. The real reasons to keep the hand-rolled store stand on their own: `@recompose/contracts` must be readable by `packages/engine`, which ADR-0010 forbids from importing `electron` at all, and electron-store cannot cross that boundary. Flagging it because ADR-0016 is accepted and cannot be edited; if this matters, it is a superseding-record decision, not a settings-screen one.

### 13. Acceptance criteria for the main-process integrations are testable

`electronApplication.evaluate()` runs its callback **in the Electron main process**, receiving the result of `require('electron')` as its argument ([Playwright docs](https://playwright.dev/docs/api/class-electronapplication)). That makes the three OS integrations assertable in the existing `acceptance` project (`apps/desktop/e2e/playwright.config.ts`) without new tooling:

- Launch at login: assert `app.getLoginItemSettings().openAtLogin` after toggling, guarded to macOS/Windows.
- Tray: assert a `Tray` instance exists / `tray.isDestroyed()` after toggling, and that the app survives closing the last window.
- Reveal folder: assert the `openPath` promise resolves to an empty string.

The Linux login-item path has no Electron API to assert against, so its acceptance is a filesystem assertion on `~/.config/autostart/<name>.desktop` (redirectable via the existing `resolveUserDataOverride` pattern in `apps/desktop/src/main/user-data-override.ts`, which already proves this repo can inject paths for tests).

---

### Recommendation summary

1. Adopt **Base UI (`@base-ui/react`)** for the shared layer. Decisive reasons: it is the only stable option that ships a number field whose input is `type="text"` (matching GOV.UK's finding), it has `Field`/`Fieldset` for the grouped row, and it has an explicit CSP nonce story that respects ADR-0028. Record the Radix rejection (no number field) and the RAC/Ark rejections (unused multi-framework and i18n surface) in the ADR.
2. Build the segmented control on **Radio Group**, never Toggle Group.
3. Commit switch and segmented-control changes on change; commit the port field **on blur**, per the instant-apply exception.
4. Implement launch at login as `app.setLoginItemSettings`/`getLoginItemSettings` on macOS and Windows, and a **hand-written XDG `.desktop` writer** on Linux using `process.env.APPIMAGE ?? process.execPath`. Reject `auto-launch` on the record.
5. Use `shell.openPath`, not `showItemInFolder`, and map its resolved error string into the `IpcError` envelope.
6. Drive theme from `nativeTheme.themeSource` in main; change no renderer CSS.
7. Mint the token as `randomBytes(32).toString('base64url')`, store via the existing vault helpers behind an `isEncryptionAvailable()` guard.
8. Copy the token through a main-process `clipboard` channel, not `navigator.clipboard`.
9. Render unavailable rows with `aria-disabled="true"` plus an `aria-describedby` reason; keep them focusable.

### Open questions and thin evidence

- **Base UI NumberField's exposed ARIA role** is undocumented beyond `aria-roledescription="Number field"`. Verify with the a11y addon against the APG Spinbutton pattern before locking the primitive in.
- **Whether Electron's deny-all check handler actually blocks `navigator.clipboard.writeText`** is unconfirmed by any primary source I found. The main-process clipboard route makes the question moot; only chase it if you want the Web API.
- **Whether the Radix ToggleGroup `radiogroup` fix (PR #3189) shipped** is unresolved. Irrelevant under the recommendation above, noted for completeness.
- **The proposal's "reveal a folder in Finder" versus the spec's "opens at that folder"** are different behaviours in Electron. I recommended the spec's wording; if the proposal's wording is the intended behaviour, it is `showItemInFolder` and loses the failure signal. Worth a maintainer confirmation.
- **I could not retrieve Apple HIG text** for either Settings or Segmented Controls; those pages render client-side and returned title-only content. The design-side guidance in this brief therefore rests on GNOME HIG, WAI-ARIA APG, and Nielsen, not Apple. Do not cite Apple HIG on my authority.
- **The ADR-0016 electron-store premise is factually stale.** Reported, not acted on.

Sources:

- [OpenSpec change proposal](file://openspec/changes/settings-screen/proposal.md)
- [OpenSpec settings spec](file://openspec/changes/settings-screen/specs/settings/spec.md)
- [Base UI v1.0.0 release](https://github.com/mui/base-ui/releases/tag/v1.0.0)
- [InfoQ: Base UI v1 accessible](https://infoq.com/news/2026/02/baseui-v1-accessible/)
- [Base UI NumberField](https://base-ui.com/react/components/number-field)
- [Base UI NumberFieldInput source](https://raw.githubusercontent.com/mui/base-ui/master/packages/react/src/number-field/input/NumberFieldInput.tsx)
- [Base UI SwitchRoot source](https://raw.githubusercontent.com/mui/base-ui/master/packages/react/src/switch/root/SwitchRoot.tsx)
- [Base UI Switch](https://base-ui.com/react/components/switch)
- [Base UI Radio](https://base-ui.com/react/components/radio)
- [Base UI CSP Provider](https://base-ui.com/react/utils/csp-provider)
- [Radix Primitives introduction](https://www.radix-ui.com/primitives/docs/overview/introduction)
- [Radix Switch](https://www.radix-ui.com/primitives/docs/components/switch)
- [Radix Toggle Group](https://www.radix-ui.com/primitives/docs/components/toggle-group)
- [Radix Password Toggle Field](https://www.radix-ui.com/primitives/docs/components/password-toggle-field)
- [radix-ui/primitives#3188: Toggle Group should have radiogroup role](https://github.com/radix-ui/primitives/issues/3188)
- [React Aria Components NumberField](https://react-aria.adobe.com/NumberField)
- [react-aria-components package.json](https://raw.githubusercontent.com/adobe/react-spectrum/main/packages/react-aria-components/package.json)
- [Ark UI introduction](https://ark-ui.com/docs/overview/introduction)
- [WAI-ARIA APG: Switch pattern](https://www.w3.org/WAI/ARIA/apg/patterns/switch/)
- [WAI-ARIA APG: Radio Group pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/)
- [WAI-ARIA APG: Spinbutton pattern](https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/)
- [MDN: aria-disabled](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-disabled)
- [MDN: color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme)
- [GOV.UK: why we changed the input type for numbers](https://technology.blog.gov.uk/2020/02/24/why-the-gov-uk-design-system-team-changed-the-input-type-for-numbers/)
- [GNOME HIG 2.2.1 (instant apply, §3.3.1)](https://p.janouch.name/files/gnome-hig-2.2.1/)
- [GNOME HIG: Switches](https://developer.gnome.org/hig/patterns/controls/switches.html)
- [Jakob Nielsen: Inactive GUI Controls](https://www.uxtigers.com/post/inactive-buttons)
- [Electron: app API](https://www.electronjs.org/docs/latest/api/app)
- [Electron: Tray API](https://www.electronjs.org/docs/latest/api/tray)
- [Electron: Tray tutorial](https://www.electronjs.org/docs/latest/tutorial/tray)
- [Electron: shell API](https://www.electronjs.org/docs/latest/api/shell)
- [Electron: nativeTheme API](https://www.electronjs.org/docs/latest/api/native-theme)
- [Electron: safeStorage API](https://www.electronjs.org/docs/latest/api/safe-storage)
- [Electron: session API](https://www.electronjs.org/docs/latest/api/session)
- [electron/electron#15198: openAtLogin on Linux (wontfix)](https://github.com/electron/electron/issues/15198)
- [XDG Desktop Application Autostart Specification v0.5](http://specifications.freedesktop.org/autostart/latest/)
- [Teamwork/node-auto-launch](https://github.com/Teamwork/node-auto-launch)
- [node-auto-launch#48: Linux launches electron executable](https://github.com/Teamwork/node-auto-launch/issues/48)
- [node-auto-launch#85: launches electron window when no path specified](https://github.com/Teamwork/node-auto-launch/issues/85)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [RFC 6750: Bearer Token Usage](https://www.rfc-editor.org/rfc/rfc6750.html)
- [RFC 6335: Port number ranges](https://www.rfc-editor.org/rfc/rfc6335.html)
- [Node.js crypto docs](https://nodejs.org/api/crypto.html)
- [Node.js buffer docs](https://nodejs.org/api/buffer.html)
- [Playwright: ElectronApplication](https://playwright.dev/docs/api/class-electronapplication)
- [Tailwind CSS: dark mode](https://tailwindcss.com/docs/dark-mode)
- [sindresorhus/electron-store](https://github.com/sindresorhus/electron-store)
