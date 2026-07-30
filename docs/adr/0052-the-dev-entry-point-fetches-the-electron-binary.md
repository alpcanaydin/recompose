# 0052: The dev entry point fetches the Electron binary

**Status**: Accepted
**Date**: 2026-07-30

## Context

A fresh clone couldn't run `pnpm dev`. It failed with `Error: Electron uninstall` from `getElectronPath` inside electron-vite, and `node_modules/electron/` held `install.js` but no `dist/` and no `path.txt`. Continuous integration stayed green throughout, which made the failure look like a local install problem.

Issue #93 recorded three candidate causes, all pointing at pnpm skipping a lifecycle script. Measurement ruled every one of them out.

- `electron@43.2.0` publishes **no `scripts` field at all**, confirmed both in the store copy and in the registry document. No postinstall exists for pnpm to skip.
- pnpm doesn't strip scripts from the store. `@fission-ai/openspec` sits at `allowBuilds: false` and its store copy still carries its full `scripts` block, so an absent script means the package published none.
- Electron 43 moved the download to first use. Its `index.js` reads `path.txt`, and when the file is missing it spawns `install.js` itself. The package also ships an `install-electron` bin for the same job.
- electron-vite reimplements that resolution. `electron-vite@6.0.0-beta.1` reads `path.txt` directly and throws `Electron uninstall` when it's absent, so it never reaches Electron's own downloader.

That closes the gap between the two environments. The end-to-end suite launches through Playwright, which goes through `require('electron')` and therefore takes the lazy path. Continuous integration also carries an explicit `node node_modules/electron/install.js` step, added when this first bit. `pnpm dev` goes through electron-vite, which reaches neither. The `--trust-lockfile` flag the issue suspected plays no part.

`electron-vite build` needs no binary, proven by building in a worktree that had none. The break is `dev` alone.

A first attempt put the fetch in `apps/desktop`'s postinstall, which is the shape issue #93 preferred. It hung the packaged build: `electron-builder --dir` runs 8 seconds on every other branch. On that one it passed 18 minutes, and the run ended only on a cancel. Both the installer and electron-builder pull through `@electron/get` into the same cache, and moving the fetch into the install lifecycle put them in each other's way.

## Decision

`apps/desktop`'s `dev` script fetches the binary before starting electron-vite:

```sh
install-electron && electron-vite dev
```

`install.js` exits early when the binary is present, so every run after the first costs nothing. The fetch sits at the one entry point that needs it and can't reach it. That keeps it out of the install lifecycle, where electron-builder pulls from the same cache.

## Alternatives

- **Fetch in the postinstall**: the shape the issue preferred, and it hung `electron-builder --dir` for 18 minutes against 8 seconds elsewhere. Measurement overruled the preference.
- **Wait for electron-vite to call Electron's downloader**: the correct upstream fix, and it leaves every clone broken until it ships. The beta pin makes that wait open-ended.
- **Document `--trust-lockfile` as the local install command**: the issue's own weakest option, and measurement cleared the flag of any part in this.
- **Set `ELECTRON_OVERRIDE_DIST_PATH`**: moves the problem to whoever has to know what to set it to.
- **A root postinstall**: `electron` is a dependency of `apps/desktop`, so its bin sits on that package's script path, and the same lifecycle contention would apply.

## Consequences

**Good**: `pnpm dev` works from a fresh clone. The one entry point that can't reach Electron's lazy download now triggers it, and nothing else changes.

**Bad**: `pnpm install` still leaves no binary, so a future consumer that reads `path.txt` without downloading breaks the same way and needs the same line. The repository also owns a step Electron used to own. The pairing of an Electron major bump with an electron-vite bump is the moment to check whether the line can go.
