# 0052: The desktop postinstall fetches the Electron binary

**Status**: Accepted
**Date**: 2026-07-30

## Context

A fresh clone couldn't run `pnpm dev`. It failed with `Error: Electron uninstall` from `getElectronPath` inside electron-vite, and `node_modules/electron/` held `install.js` but no `dist/` and no `path.txt`. Continuous integration stayed green throughout, which made the failure look like a local install problem.

Issue #93 recorded three candidate causes, all pointing at pnpm skipping a lifecycle script. Measurement ruled every one of them out.

- `electron@43.2.0` publishes **no `scripts` field at all**, confirmed both in the store copy and in the registry document. No postinstall exists for pnpm to skip.
- pnpm doesn't strip scripts from the store. `@fission-ai/openspec` sits at `allowBuilds: false` and its store copy still carries its full `scripts` block, so an absent script means the package published none.
- Electron 43 moved the download to first use. Its `index.js` reads `path.txt`, and when the file is missing it spawns `install.js` itself. The package also ships an `install-electron` bin for the same job.
- electron-vite reimplements that resolution. `electron-vite@6.0.0-beta.1` reads `path.txt` directly and throws `Electron uninstall` when it's absent, so it never reaches Electron's own downloader.

That closes the gap between the two environments. The end-to-end suite launches through Playwright, which goes through `require('electron')` and therefore takes the lazy path. `pnpm dev` goes through electron-vite, which doesn't. The `--trust-lockfile` flag the issue suspected plays no part.

## Decision

`apps/desktop`'s postinstall runs Electron's own installer before rebuilding native modules:

```sh
install-electron && electron-builder install-app-deps
```

`install.js` exits early when the binary is already present, so repeat installs cost nothing. Native module rebuilds also target a binary that now exists rather than one a later step might fetch.

## Alternatives

- **Wait for electron-vite to call Electron's downloader**: the correct upstream fix, and it leaves every clone broken until it ships. The beta pin makes that wait open-ended.
- **Document `--trust-lockfile` as the local install command**: the issue's own weakest option, and measurement cleared the flag of any part in this.
- **Set `ELECTRON_OVERRIDE_DIST_PATH`**: moves the problem to whoever has to know what to set it to.
- **A root postinstall**: `electron` is a dependency of `apps/desktop`, so its bin sits on that package's script path. The guarantee belongs where the dependency is.

## Consequences

**Good**: `pnpm install` alone leaves a tree that runs. The guarantee is explicit rather than resting on which entry point happens to trigger a lazy download.

**Bad**: the repository now owns a step Electron used to own, and it'll stay after electron-vite catches up, where it costs an early exit per install. The pairing of an Electron major bump with an electron-vite bump is the moment to check whether the line can go.
