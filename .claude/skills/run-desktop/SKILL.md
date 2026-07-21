---
name: run-desktop
description: Launch the recompose desktop app (apps/desktop) for development or verification. Use when asked to run, start, or visually verify the app.
---

# Run Desktop

## Dev mode (HMR)

```bash
pnpm dev
```

Runs `turbo run dev` → `electron-vite dev` in `apps/desktop`. Opens the Electron window; renderer has HMR, main-process changes trigger a rebuild+relaunch. Main and utilityProcess logs stream to this terminal. Stop with ctrl-c.

For background verification: run with `run_in_background`, watch stdout for `ready` / error lines, then screenshot or interact as needed.

## Production-like check

```bash
pnpm build && pnpm --filter @recompose/desktop start
```

`start` runs `electron-vite preview` against the built `out/` bundle.

## Packaged app (rarely needed)

```bash
pnpm --filter @recompose/desktop build:mac
```

Output lands in `apps/desktop/dist/`. Signing/notarization not configured yet — local unpacked check only via `build:unpack`.

## Gotchas

- First run after dependency changes needs `pnpm install` (postinstall rebuilds native modules via electron-builder).
- The gateway engine (when it lands) runs in a utilityProcess — its logs are prefixed in the same terminal, and the default port is `:8397`.
