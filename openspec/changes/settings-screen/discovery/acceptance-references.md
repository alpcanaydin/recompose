# Acceptance-references brief: `settings-screen` (tier full)

## Scope and method

I read the change artifacts and the existing contracts in the worktree, then hunted vendor docs, Electron's issue tracker, W3C/WAI normative text, and design-system guidance for the places where each promised behavior is known to break. Every criterion below is written so a reviewer can turn it into a `.feature` scenario or a unit spec, and every claim carries a source.

Repository files read, recorded worktree-relative:

- `openspec/changes/settings-screen/proposal.md`
- `openspec/changes/settings-screen/specs/settings/spec.md`
- `packages/contracts/src/settings.ts`
- `packages/contracts/src/migration.ts`
- `packages/contracts/src/ipc.ts`
- `apps/desktop/package.json` (Electron `43.2.0`, React `19.2.8`, Zod `4.4.3`, Playwright `1.61.1`, no headless UI library)

I had no Glob/Grep in this session, so the repository sweep is limited to the files above. I could not locate the main-process vault or settings-store modules by path, so claims about them are stated as questions, not findings.

---

## 1. Launch at login: the switch cannot tell the truth on Linux, and lies in dev

**Finding.** `app.setLoginItemSettings` / `app.getLoginItemSettings` are documented as **macOS and Windows only** ([Electron `app` API docs](https://www.electronjs.org/docs/latest/api/app#appsetloginitemsettingssettings-macos-windows)). Linux support has been an open feature request since 2018 ([electron#15198](https://github.com/electron/electron/issues/15198)). On Linux the getter yields `openAtLogin: false` regardless of any autostart `.desktop` entry, so the spec's "the switch shows the operating system value" is unsatisfiable there. The repo ships to macOS, Windows and Linux, so this is a hard platform gap, not an edge case.

The known-failure list beyond Linux:

- **Unpackaged/dev builds register the wrong executable.** The path recorded is the Electron binary, not the app, so a login item created in `pnpm dev` does not launch the product ([electron#45672](https://github.com/electron/electron/issues/45672), closed as not planned, Electron 34 / macOS 15.3).
- **`openAtLogin: false` does not always remove the entry** ([electron#10880](https://github.com/electron/electron/issues/10880)).
- **Windows produces duplicate Startup entries** across app updates when the executable path changes ([electron#12491](https://github.com/electron/electron/issues/12491)).
- **`getLoginItemSettings` reports `openAtLogin: false` unless `path` and `args` match the values passed to the setter exactly.** This is documented behavior, not a bug ([Electron docs, `getLoginItemSettings` options](https://www.electronjs.org/docs/latest/api/app#appsetloginitemsettingssettings-macos-windows)), and it is the single most likely cause of a switch that flips back to off after a restart.
- **Store builds are excluded:** the docs state these settings "are not available on MAS builds," corroborated by [electron#37560](https://github.com/electron/electron/issues/37560) and [electron#42016](https://github.com/electron/electron/issues/42016) (APPX).
- **macOS 13+ deprecations:** `openAsHidden`, `wasOpenedAsHidden` and `restoreState` no longer work (same docs page).

**Acceptance criteria**

1. On Linux the launch-at-login row renders as unavailable and names the platform as the reason, rather than rendering an off switch. (Docs: macOS/Windows only.)
2. The renderer reads the switch state from `getLoginItemSettings()` on every mount, never from the settings document, and the settings document holds no `launchAtLogin` field.
3. `setLoginItemSettings` and `getLoginItemSettings` are called with an identical `path`/`args` pair from one shared call site; a spec asserts set-then-get round-trips to `true`.
4. When `app.isPackaged` is false the row renders as unavailable and names the dev build as the reason, so nobody registers `electron` as a login item.
5. Turning the switch off and re-reading returns `openAtLogin: false` (guards electron#10880).
6. Toggling on twice does not create a second Startup entry on Windows (guards electron#12491).

**Trade-off.** Rendering the row unavailable on Linux is honest and cheap; writing an XDG autostart `.desktop` file yourself is the alternative and is a custom implementation the project rules push back on. **Recommendation:** ship unavailable on Linux, matching the change's existing "controls that wait on machinery" pattern.

---

## 2. Menu bar tray: three documented ways to end up with no icon, a ghost icon, or an unquittable app

**Finding.** From the [Electron `Tray` docs](https://www.electronjs.org/docs/latest/api/tray):

- The `Tray` must be constructed after `app.whenReady()`.
- macOS icons must be Template Images whose filename ends in `Template`, with a matching `@2x` at 144dpi; 16x16 and 32x32@2x are the recommended sizes. Get this wrong and the icon is grainy or fails to invert in dark menu bars.
- On macOS, `mouse-up`/`mouse-down` do not fire once a context menu is set (corroborated by [electron#5058](https://github.com/electron/electron/issues/5058)).
- On Linux, mutating an existing `MenuItem` has no effect until `setContextMenu()` is called again.
- Windows wants `.ico`, and a stable GUID preserves tray position across relaunches.

Three well-documented failure modes:

- **Garbage collection.** A `Tray` held in a non-persistent binding is collected and the icon vanishes minutes later, with no error ([electron#5499](https://github.com/electron/electron/issues/5499), [electron#7095](https://github.com/electron/electron/issues/7095), [electron#10382](https://github.com/electron/electron/issues/10382)).
- **Ghost icons after quit.** Electron does not clean up the tray; the recommendation from the issue thread is an explicit `tray.destroy()` on `before-quit` ([electron#31134](https://github.com/electron/electron/issues/31134), closed as not planned).
- **No icon on GNOME.** Electron drives StatusNotifierItem, which stock GNOME Shell does not render. Users need the AppIndicator extension, and `libappindicator` must be present for the dynamic load to succeed ([gnome-shell-extension-appindicator readme](https://github.com/ubuntu/gnome-shell-extension-appindicator/blob/master/README.md), [electron#10619](https://github.com/electron/electron/issues/10619)).

On lifecycle: `window-all-closed` defaults to quitting the app, and **subscribing hands you full control** ([Electron `app` docs](https://www.electronjs.org/docs/latest/api/app#event-window-all-closed)). The docs also note that `Cmd+Q` or `app.quit()` closes windows and emits `will-quit` without ever emitting `window-all-closed`. On macOS the app already survives the last window close, so the spec's "the app keeps running and the tray stays" is only a behavior change on Windows and Linux.

**Acceptance criteria**

1. Turning the switch on creates the tray without a restart; turning it off calls `tray.destroy()` and clears the reference, and no icon remains in the system tray afterwards.
2. The `Tray` instance is held in module scope for the app's lifetime; a spec asserts the icon survives a forced GC (`--expose-gc`) or, at minimum, a lint/architecture rule forbids a function-local tray binding.
3. `before-quit` destroys the tray (guards electron#31134).
4. The tray context menu always contains a Quit item that reaches `app.quit()`. With the tray on and `window-all-closed` suppressed, this is the only way out of the app; without it the app is unquittable from its own UI.
5. macOS icon assets are named `*Template.png` and `*Template@2x.png` at 16x16 / 32x32.
6. With the tray on and the last window closed, the app process is still alive on Windows and Linux; with the tray off, closing the last window quits on Windows and Linux (macOS keeps its platform default).
7. On a Linux desktop without an AppIndicator host, the switch does not silently do nothing. Either the row warns that the desktop may not display it, or the app detects and reports the failure.

**Trade-off.** Detecting AppIndicator availability is not exposed by Electron, so criterion 7 realistically becomes a static advisory string, not a runtime probe. Say so in the ADR rather than pretending to detect it.

---

## 3. Reveal the config folder: pick `openPath`, not `showItemInFolder`

**Finding.** `shell.showItemInFolder(fullPath)` has **no documented return value and no error channel**; `shell.openPath(path)` returns `Promise<string>` that resolves to `""` on success or an error message on failure ([Electron `shell` docs](https://www.electronjs.org/docs/latest/api/shell)). The spec requirement is to "open that folder in the operating system file browser," which is exactly `openPath`'s job. `showItemInFolder` is for selecting a file inside its parent, and it carries a long defect tail: forward slashes break it on Windows ([electron#11617](https://github.com/electron/electron/issues/11617), [electron#13667](https://github.com/electron/electron/issues/13667)), a `.` in the path breaks it ([electron#23884](https://github.com/electron/electron/issues/23884)), it mis-locates files under macOS `Documents` ([electron#44955](https://github.com/electron/electron/issues/44955)), it can hang Finder for around a minute ([electron#38540](https://github.com/electron/electron/issues/38540)), and it opens the parent when handed a directory ([electron#10095](https://github.com/electron/electron/issues/10095), [electron#7790](https://github.com/electron/electron/issues/7790)).

The proposal text says "a call that reveals a folder in Finder," which reads like `showItemInFolder`. That is the wrong primitive for the stated requirement.

**Acceptance criteria**

1. Revealing the config folder calls `shell.openPath` and surfaces a non-empty resolved string as a visible error, never a silent no-op. The project's own clean-code rule forbids swallowing it (`.claude/rules/clean-code.md`, "No silent failures").
2. The folder path shown on screen is the same value passed to `openPath`, sourced from `app.getPath('userData')` in the main process, never reconstructed in the renderer.
3. If the directory does not exist yet, the app creates it (or reports the failure) before opening; `openPath` on a missing path resolves to an error string.
4. A path containing a space, a `.`, and a non-ASCII character round-trips (Windows-flavoured regression guard).

**Recommendation.** Use `shell.openPath` and assert on its resolved value. It is the only one of the two that can fail loudly.

---

## 4. Gateway token and the vault: `safeStorage` is not available everywhere, and it can be plaintext

**Finding.** From the [Electron `safeStorage` docs](https://www.electronjs.org/docs/latest/api/safe-storage):

- `isEncryptionAvailable()` returns true on Linux only after `ready` **and** when a secret key is available.
- `getSelectedStorageBackend()` (Linux) returns `basic_text` when no keyring is present, and the docs warn plainly: "If no secret store is available, items stored in using the `safeStorage` API will be unprotected as they are encrypted via hardcoded plaintext password."
- The async pair (`encryptStringAsync` / `decryptStringAsync`) is now the recommended API because it is non-blocking, supports key rotation, and handles temporary unavailability gracefully. `decryptStringAsync` returns a `shouldReEncrypt` flag for rotation.

Known breakage: on desktops where `XDG_CURRENT_DESKTOP` is unrecognised (Hyprland, Sway, i3), Chromium falls back to `basic_text` and `encryptString` **throws instead of degrading**, which has shipped as a user-visible sign-in failure in at least one Electron app ([letta-code#2233](https://github.com/letta-ai/letta-code/issues/2233)). `isEncryptionAvailable()` has also returned false on Windows ([electron#33640](https://github.com/electron/electron/issues/33640)), and `decryptString` throws on ciphertext written under a different backend or profile ([electron#32598](https://github.com/electron/electron/issues/32598)).

Directly relevant to this repo, which is `"type": "module"`: **ESM named imports of `electron` eagerly evaluate every module getter**, which used to construct `SafeStorage` and touch the OS keychain on `app.ready` even if `safeStorage` was never used, producing an unexplained keychain prompt at launch. Fixed by lazily initialising the async encryptor ([electron#50419](https://github.com/electron/electron/pull/50419)); the backport thread states the parent fix shipped in **v43.0.0-beta.1** ([electron#51924](https://github.com/electron/electron/pull/51924), merged 9 June 2026), so `43.2.0` has it. Treat this as a regression guard rather than an open bug.

On token generation: OWASP requires a CSPRNG and **at least 128 bits of entropy**, and warns that encoded length is not entropy ([OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [Insufficient Session-ID Length](https://owasp.org/www-community/vulnerabilities/Insufficient_Session-ID_Length)). NIST SP 800-63B revision 4 says verifiers **SHOULD** offer an option to display a secret while it is entered and **SHALL** allow password managers, with paste explicitly permitted ([NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html)). That supports the masked-with-reveal design.

**Acceptance criteria**

1. The token is minted from `crypto.randomBytes` (or `webcrypto.getRandomValues`) with at least 16 random bytes. A spec asserts the byte length and that two consecutive mints differ. `Math.random`, timestamps and UUIDs are rejected.
2. Before any write, the main process checks `safeStorage.isEncryptionAvailable()`. When false, the token row renders unavailable with a named reason and the app writes nothing. The existing `vault-unavailable` code in `packages/contracts/src/ipc.ts` (line 9) is the right carrier.
3. On Linux, when `getSelectedStorageBackend()` returns `basic_text`, the screen states that the token is stored unencrypted before the user mints one. Silently writing a plaintext-equivalent secret is the failure this criterion prevents.
4. `encryptString`/`decryptString` calls are wrapped so a throw becomes a typed `IpcError`, never an unhandled rejection (guards letta-code#2233 and electron#32598).
5. Launching the app with the token requirement off performs zero keychain access. Assert no `safeStorage` call happens on `ready` (regression guard for electron#50419 in an ESM main process).
6. A serialisation spec asserts the settings document written to disk contains no token-shaped value, under both requirement-on and requirement-off states. This is the spec's "the settings document never carries the token" scenario and it deserves a property-based test over generated settings documents.
7. Turning the requirement off, restarting, and turning it on again returns the identical token.
8. The masked display reveals the full value on explicit action and supports selection/copy (NIST SP 800-63B).

**Trade-off worth an ADR line.** Copying a token to the clipboard exposes it to Windows Clipboard History (`Win+V`, last 25 items, plaintext) and its optional cloud sync ([Microsoft cloud clipboard configuration overview](https://4sysops.com/archives/configuring-the-cloud-clipboard-in-windows-1011-with-group-policy-and-powershell/)). Electron cannot suppress that. Options are: accept and document, or accept and clear the clipboard after a timeout. I found no vendor guidance mandating either; treat the choice as a decision, not a finding.

**Recommendation.** Prefer `encryptStringAsync`/`decryptStringAsync` over the sync pair, per the vendor's own recommendation, and honour `shouldReEncrypt` so a rotated OS key does not strand the token.

---

## 5. Instant apply with no save action

**Finding.** WCAG **3.2.2 On Input (Level A)** is normative and reads: "Changing the setting of any user interface component does not automatically cause a change of context unless the user has been advised of the behavior before using the component" ([W3C Understanding 3.2.2](https://www.w3.org/WAI/WCAG22/Understanding/on-input.html)). Applying a preference immediately is fine; what is forbidden is an automatic change of focus, viewport, window or page meaning as a side effect. A theme repaint is not a change of context. Anything that would move focus or reload the view would be.

Instant apply as a convention is stated most explicitly in the legacy GNOME HIG: "Update values or settings immediately to reflect the changes made in the window. This is known as 'instant apply'. Do not make the user press an OK or Apply button... unless... the change will take more than about one second to apply," and instant-apply windows should carry no dismissal button ([GNOME HIG 2.2.1](https://p.janouch.name/files/gnome-hig-2.2.1/), [GNOME HIG mailing-list decision, January 2002](https://mail.gnome.org/archives/hig/2002-January/msg00028.html)). I could not extract Apple's current Human Interface Guidelines Settings page; it rendered as a title only, so I am not citing Apple.

**Persistence risk.** `settings:save` in `packages/contracts/src/ipc.ts` (line 36) takes the **whole settings document**. Instant apply plus whole-document writes means one full write per keystroke in the port field, and last-write-wins clobbering if two rows change quickly. High-frequency non-atomic config writes are a documented corruption source: [claude-code#28809](https://github.com/anthropics/claude-code/issues/28809) (non-atomic write plus concurrent read yields truncated JSON and a wiped config) and [claude-code#29050](https://github.com/anthropics/claude-code/issues/29050) (thousands of writes per session plus antivirus `EPERM` on Windows).

**Acceptance criteria**

1. Changing any control persists without a save action, and the screen shows no Save, Apply, OK or Cancel button.
2. Changing a control does not move focus, open a window, or navigate. Focus remains on the control the user just operated (WCAG 3.2.2).
3. The theme repaint is observable in the same frame budget as the toggle; the stored document holds the new theme after a restart (spec scenario 1).
4. A text field that persists on change debounces or persists on blur/commit, not on every keystroke, and a spec asserts that typing N characters produces fewer than N disk writes.
5. The settings file is written atomically (temp file, then rename), and a spec asserts that an interrupted write leaves the previous document intact.
6. Two settings changed in rapid succession both survive; neither is clobbered by a stale whole-document write.
7. When a write fails, the control reverts to the stored value and the failure is surfaced. The `storage-failed` code already exists in `ipc.ts` line 9.

---

## 6. The three new shared components

### Switch

[WAI-ARIA APG switch pattern](https://www.w3.org/WAI/ARIA/apg/patterns/switch/): `role="switch"` (or `input[type=checkbox]`), `aria-checked` true/false, an accessible name from content, `aria-labelledby` or `aria-label`, Space toggles and Enter optionally toggles. The pattern states a hard rule: **"It is critical the label on a switch does not change when its state changes."** GNOME's HIG adds that switches are for binary state only, that labels are nouns ("Notifications", not "Enable notifications"), and that an unavailable feature's switch should be made insensitive ([GNOME HIG switches](https://developer.gnome.org/hig/patterns/controls/switches.html)).

**Criteria:** role and `aria-checked` present and correct in both states; Space toggles; the accessible name is identical in both states; the label is a noun phrase; no third state.

### Segmented control (sources conflict, see section 9)

[GitHub Primer's SegmentedControl accessibility guidance](https://primer.style/product/components/segmented-control/accessibility/) explicitly rejects `radiogroup` ("requires a save button to apply changes"), `tablist` ("used to switch between tab panels") and `toolbar`. It prescribes a `<ul>` of `<li><button>`, `aria-current="true"` on the selected segment, Tab to move focus between buttons, Enter/Space to select, and **no arrow-key navigation**. The [WAI-ARIA APG radio pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/) prescribes the opposite mechanics: one tab stop, arrow keys move focus and change selection immediately with wraparound.

**Criteria:** whichever pattern is chosen, keyboard behavior matches that pattern exactly and no other; the group carries an accessible name via `aria-labelledby` or `aria-label`; the selected option is programmatically determinable; a change applies immediately (no save button), which is the property both sources agree the component must have.

### Numeric field (port)

The GOV.UK Design System team **dropped `input type="number"`** after user testing: the spinner increments on scroll wheel while focused (silently changing a submitted value), it breaks zoom and autofill, NVDA has listed it as unlabelled, and Dragon NaturallySpeaking cannot dictate into it. Their replacement is `<input type="text" inputmode="numeric">` ([GOV.UK Technology blog, 24 February 2020](https://technology.blog.gov.uk/2020/02/24/why-the-gov-uk-design-system-team-changed-the-input-type-for-numbers/)).

**Criteria:** the field is not `type="number"`, or if it is, the wheel event cannot change the value while focused; the field is dictatable and its accessible name is exposed; the accepted range is stated in visible text and associated via `aria-describedby`; an out-of-range or non-numeric entry leaves the stored port untouched (spec scenario 2).

### Unavailable rows

`disabled` removes an element from the tab order and hides its reason from screen-reader users; `aria-disabled="true"` exposes the disabled state while keeping the element focusable and discoverable ([MDN `aria-disabled`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-disabled)). The spec requires each unavailable row to "name what it waits for," which a keyboard user can only hear if the row is reachable.

**Criteria:** unavailable rows use `aria-disabled="true"` rather than `disabled`, remain in the tab order, and expose the waiting-on reason via `aria-describedby`; the control cannot be operated by keyboard or pointer; the settings document holds no field for that row.

---

## 7. Schema v2 and the migration

**Repository findings** (these are defects and gaps in code I read, not external claims):

- `packages/contracts/src/migration.ts` lines 46-55: the loop re-reads `schemaVersion` from the migrated document and looks the step up by that version. **A migration step that returns a document without bumping `schemaVersion` produces an infinite loop**, not an error. There are zero migrations today, so nothing exercises it; the v1 to v2 step will be the first.
- `packages/contracts/src/settings.ts` line 10 already encodes `enginePort: z.int().min(1024).max(65535)`, exactly the range in the spec scenario. The screen's "the field states the range it accepts" copy should derive from that schema, not restate the numbers.
- `settingsSchema` is a `z.strictObject`, so an unknown key rejects. Combined with `migrateDocument` throwing on a newer `schemaVersion`, a downgrade (a v2 document read by an older build) throws. `loadSettings` propagates the throw with no recovery path.
- The vault already models the downgrade case as a typed error: `vault-newer-schema` in `ipc.ts` line 9. Settings has no equivalent.

**External prior art.** `electron-store`'s migration feature is documented by its own maintainers as buggy and unsupported, and its central defect is version tracking that defaults to the wrong version so later migrations never run ([electron-store#108](https://github.com/sindresorhus/electron-store/issues/108)). Its schema validation throws uncaught on read ([electron-store#116](https://github.com/sindresorhus/electron-store/issues/116)), and it clears the config on a `SyntaxError`. The repo's hand-rolled `migrateDocument` avoids the version-tracking trap by reading the version from the document itself, which is the better design. It has not yet avoided the throw-on-read trap.

**Acceptance criteria**

1. A v1 document with `{schemaVersion: 1, theme, enginePort}` migrates to v2 preserving both existing values.
2. A migration step that does not advance `schemaVersion` fails with a named error rather than looping. Add this as a unit spec against `migrateDocument` before writing the v1-to-v2 step.
3. A document with `schemaVersion: 3` produces a typed error (mirror `vault-newer-schema`) that reaches the screen as readable text, not a crash and not a silent reset to defaults.
4. A corrupt or unparseable settings file does not destroy the user's data silently. Choose a policy (fail visibly, or back up then reset) and assert it. `electron-store`'s silent clear is the anti-pattern.
5. Migration is idempotent: running it on an already-v2 document is a no-op.
6. Property-based coverage: for any valid v1 document generated by fast-check, migrating then parsing under v2 succeeds. The repo already has `@fast-check/vitest` in both `packages/contracts` and `apps/desktop`.

---

## 8. Port validation, theme, and motion

**Port.** RFC 6335 section 6 defines System Ports 0-1023, User Ports 1024-49151, and Dynamic/Private/Ephemeral 49152-65535 ([RFC 6335](https://www.rfc-editor.org/rfc/rfc6335.html)). The schema's floor of 1024 correctly excludes the privileged range. The ceiling of 65535 admits the ephemeral range, where the OS hands out outbound ports, so a valid entry can still fail to bind.

On Windows the failure is invisible: Hyper-V / HNS (present with WSL2, Docker Desktop, or Windows Sandbox) reserves semi-random TCP blocks at boot that `netsh interface ipv4 show excludedportrange` does not always report. A real product shipped this as a bug where the bind error was swallowed and the UI showed only a generic failure ([httptoolkit#901](https://github.com/httptoolkit/httptoolkit/issues/901)).

**Criteria:** a port outside 1024-65535 is rejected and the stored value is unchanged; a port in 49152-65535 is accepted but the field warns it may collide with an ephemeral allocation; a bind failure (`EADDRINUSE`, `EACCES`) surfaces as a message naming the port and the reason, never as a silent no-op.

**Theme.** `nativeTheme.themeSource` accepts `system | light | dark`, defaults to `system`, and propagates to the renderer so `prefers-color-scheme` rules update ([Electron `nativeTheme` docs](https://www.electronjs.org/docs/latest/api/native-theme), [Dark Mode tutorial](https://www.electronjs.org/docs/latest/tutorial/dark-mode)). One open regression to watch: Electron v39 (Chromium 142) inverted `shouldUseDarkColors` and `matchMedia('(prefers-color-scheme: dark)')` at runtime on Linux/KDE/Wayland ([electron#48736](https://github.com/electron/electron/issues/48736), open). The repo is on `43.2.0`, so I could not confirm whether v43 still carries it.

**Criteria:** `themeSource` is set from the main process only; the stored theme is applied before the first paint so no flash of the wrong theme occurs; with `system` selected, changing the OS theme at runtime repaints the app without a restart; `shouldUseDarkColors` and the rendered theme agree (guards electron#48736).

**Reduced motion.** WCAG **2.3.3 Animation from Interactions** is Level AAA: motion animation triggered by interaction must be disableable unless essential, and honouring `prefers-reduced-motion` is named as a sufficient approach ([W3C Understanding 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)). The change defers the "reduced wire motion" row to the canvas. That is fine for the in-app control, but the OS-level preference should already be honoured by anything that animates today (drawers, view transitions).

**Criterion:** with `prefers-reduced-motion: reduce` set at the OS level, existing UI transitions are suppressed regardless of the deferred in-app row.

---

## 9. Where the sources conflict or the evidence is thin

1. **Segmented control semantics: a genuine conflict.** Primer says never `radiogroup` because radio groups imply deferred submission; the WAI-ARIA APG radio pattern is the standard for immediate single-select and says nothing requiring a save button. Both are credible. Primer is a shipped design system with the exact component; the APG is the normative-adjacent authority. Neither can be dismissed. **My read:** the APG radio pattern is safer for screen-reader support, and Primer's stated objection (that radio groups need a save button) is a convention claim, not a normative one. But this is a judgement call and I am flagging it rather than deciding it. Whichever way it goes, the ADR should name the rejected option and why, and the keyboard spec must match one pattern completely.
2. **Apple's Human Interface Guidelines could not be read.** The Settings page rendered as a title only. I have GNOME's instant-apply guidance and nothing from Apple. Do not attribute instant-apply convention to Apple on my say-so.
3. **The `nativeTheme` v39 regression on v43 is unconfirmed.** The issue is open against v39 with a Chromium 142 root cause and no fix PR visible. Whether `43.2.0` is affected needs a manual check on a Linux/KDE/Wayland box, which I could not perform.
4. **The `safeStorage` ESM keychain fix landing in v43 comes from the backport PR description**, which states the parent change shipped in `v43.0.0-beta.1`. I did not read a v43 release note stating it directly. Confidence is good, not certain.
5. **Ghost tray icons and GC collection are community-diagnosed, not vendor-documented.** Both issues are closed as not planned. The `tray.destroy()` on `before-quit` remedy comes from the issue thread, not from Electron's docs.
6. **Clipboard handling of the token has no vendor guidance I could find.** The Windows Clipboard History exposure is real and documented; what to do about it is a decision, not a finding.
7. **I could not inspect the main-process vault or settings store**, so I cannot say whether writes are already atomic or whether `safeStorage` availability is already checked. Criteria 4.2, 5.5 and 5.7 may already be satisfied.

---

## Recommendation

Split the acceptance suite along the same seam the change already uses. The three platform integrations (login item, tray, reveal folder) carry the highest density of documented breakage and the lowest testability under Playwright, since Playwright's Electron support cannot drive tray icons or native menus and the supported technique is stubbing main-process APIs through `electronApplication.evaluate()` ([Playwright ElectronApplication API](https://playwright.dev/docs/api/class-electronapplication), [playwright#2632](https://github.com/microsoft/playwright/issues/2632)). Cover them with main-process integration specs that assert on `getLoginItemSettings()` return values, tray lifecycle, and `openPath`'s resolved string, and reserve e2e for the renderer behaviors: instant apply, the port range rejection, the masked token, and the unavailable rows.

Three criteria I would treat as non-negotiable because each guards a failure that ships silently:

- **The settings document never carries the token**, asserted as a property over generated documents.
- **A migration step that does not advance `schemaVersion` fails loudly**, added to `migration.ts` before the first real migration is written.
- **Every one of `openPath`, `safeStorage`, and the settings write surfaces its failure**, per the repo's own no-silent-failures rule.

And one scope change worth raising before implementation: **launch at login has no Linux implementation in Electron and is not going to get one**, so the row belongs in the same "unavailable, and here is what it waits for" treatment the change already applies to bind address, gateway autostart, log retention and reduced wire motion. That is a fifth deferred row the proposal does not currently list.

---

## Sources

- [Electron `app` API (setLoginItemSettings, getLoginItemSettings, window-all-closed, before-quit, will-quit)](https://www.electronjs.org/docs/latest/api/app)
- [Electron `Tray` API](https://www.electronjs.org/docs/latest/api/tray)
- [Electron `safeStorage` API](https://www.electronjs.org/docs/latest/api/safe-storage)
- [Electron `shell` API](https://www.electronjs.org/docs/latest/api/shell)
- [Electron `nativeTheme` API](https://www.electronjs.org/docs/latest/api/native-theme) and [Dark Mode tutorial](https://www.electronjs.org/docs/latest/tutorial/dark-mode)
- [electron#15198 Add openAtLogin support for Linux](https://github.com/electron/electron/issues/15198)
- [electron#10880 Disable setLoginItemSettings openAtLogin not working](https://github.com/electron/electron/issues/10880)
- [electron#12491 setLoginItemSettings creates duplicate Startup entries on Windows](https://github.com/electron/electron/issues/12491)
- [electron#45672 setLoginItemSettings openAtLogin not working on macOS](https://github.com/electron/electron/issues/45672)
- [electron#37560 openAtLogin in MAS build not working](https://github.com/electron/electron/issues/37560)
- [electron#42016 setLoginItemSettings in APPX](https://github.com/electron/electron/issues/42016)
- [electron#5499](https://github.com/electron/electron/issues/5499), [electron#7095](https://github.com/electron/electron/issues/7095), [electron#10382](https://github.com/electron/electron/issues/10382) tray icon disappears (garbage collection)
- [electron#31134 dead tray icons after quit](https://github.com/electron/electron/issues/31134)
- [electron#5058 tray right-click event not emitted when a context menu is set](https://github.com/electron/electron/issues/5058)
- [electron#10619 Make AppIndicator default on GNOME](https://github.com/electron/electron/issues/10619) and [ubuntu/gnome-shell-extension-appindicator readme](https://github.com/ubuntu/gnome-shell-extension-appindicator/blob/master/README.md)
- [electron#11617](https://github.com/electron/electron/issues/11617), [electron#13667](https://github.com/electron/electron/issues/13667), [electron#23884](https://github.com/electron/electron/issues/23884), [electron#44955](https://github.com/electron/electron/issues/44955), [electron#38540](https://github.com/electron/electron/issues/38540), [electron#10095](https://github.com/electron/electron/issues/10095), [electron#7790](https://github.com/electron/electron/issues/7790) showItemInFolder defects
- [electron#32206 safeStorage segfault on Linux before first window](https://github.com/electron/electron/issues/32206)
- [electron#33640 isEncryptionAvailable returns false on Windows](https://github.com/electron/electron/issues/33640)
- [electron#32598 decryptString error](https://github.com/electron/electron/issues/32598)
- [electron#50419 lazily initialize safeStorage async encryptor](https://github.com/electron/electron/pull/50419) and [electron#51924 backport](https://github.com/electron/electron/pull/51924)
- [electron#48736 v39 nativeTheme regression](https://github.com/electron/electron/issues/48736)
- [letta-code#2233 safeStorage failure on non-standard Linux desktops](https://github.com/letta-ai/letta-code/issues/2233)
- [W3C Understanding WCAG 3.2.2 On Input](https://www.w3.org/WAI/WCAG22/Understanding/on-input.html)
- [W3C Understanding WCAG 2.3.3 Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)
- [WAI-ARIA APG switch pattern](https://www.w3.org/WAI/ARIA/apg/patterns/switch/)
- [WAI-ARIA APG radio group pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/)
- [GitHub Primer SegmentedControl accessibility](https://primer.style/product/components/segmented-control/accessibility/)
- [GNOME HIG switches](https://developer.gnome.org/hig/patterns/controls/switches.html), [GNOME HIG 2.2.1 instant apply](https://p.janouch.name/files/gnome-hig-2.2.1/), [GNOME HIG instant-apply window buttons decision (January 2002)](https://mail.gnome.org/archives/hig/2002-January/msg00028.html)
- [GOV.UK: Why the GOV.UK Design System team changed the input type for numbers (24 February 2020)](https://technology.blog.gov.uk/2020/02/24/why-the-gov-uk-design-system-team-changed-the-input-type-for-numbers/)
- [MDN aria-disabled](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-disabled)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) and [OWASP Insufficient Session-ID Length](https://owasp.org/www-community/vulnerabilities/Insufficient_Session-ID_Length)
- [NIST SP 800-63B revision 4](https://pages.nist.gov/800-63-4/sp800-63b.html)
- [RFC 6335 section 6, port number ranges](https://www.rfc-editor.org/rfc/rfc6335.html)
- [httptoolkit#901 Windows HNS/Hyper-V invisible port reservation, swallowed bind error](https://github.com/httptoolkit/httptoolkit/issues/901)
- [Configuring the cloud clipboard in Windows 10/11](https://4sysops.com/archives/configuring-the-cloud-clipboard-in-windows-1011-with-group-policy-and-powershell/)
- [electron-store#108 migration feature is broken](https://github.com/sindresorhus/electron-store/issues/108) and [electron-store#116 schema validation uncaught error](https://github.com/sindresorhus/electron-store/issues/116)
- [claude-code#28809 non-atomic config writes](https://github.com/anthropics/claude-code/issues/28809) and [claude-code#29050 write frequency and antivirus EPERM](https://github.com/anthropics/claude-code/issues/29050)
- [Playwright ElectronApplication API](https://playwright.dev/docs/api/class-electronapplication) and [playwright#2632 working with the Electron menu](https://github.com/microsoft/playwright/issues/2632)
