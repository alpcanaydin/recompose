# 0083: The storage watcher startup window stays accepted

**Status**: Accepted
**Date**: 2026-08-08

## Context

`startStorageWatchers` arms the gateway watcher and the accounts watcher concurrently. On macOS,
Node's `fs.watch` rides one shared FSEvents stream per process. A watcher joining that stream
makes the OS rebuild it, and the rebuild drops any change landing inside it. A file edit in the
first moments after boot can therefore go unreported until the next edit.

The window surfaced while hardening the storage watcher specs after PR #144. A spec that wrote
once and waited timed out in one run of every three under the full storage suite. The specs now
repeat the write until the watcher answers, which is idempotent because the watchers compare
content before reporting a change.

The app's own writes don't depend on this path. `noteGatewayWrite` records them directly, and the
watcher exists to catch edits made outside the app. The exposed case is an external editor
touching a config file inside the boot window, a span of milliseconds on a desktop machine.

## Decision

The startup window stays as shipped behavior, documented here rather than engineered away. The
watcher API doesn't grow a reconcile hook for it, and `startStorageWatchers` keeps arming both
watchers concurrently.

If the window ever produces a real report, the named upgrade path is one reconcile read. Each
watcher exposes a method that re-reads its files and compares content. The wiring calls that
method once after the last watcher arms. The content comparison already exists inside both
watchers, so the change stays small when it becomes worth making.

## Consequences

### Positive

- The watcher contract stays one thing: best-effort reporting of content changes, with the boot
  window as its one named exception.
- No API surface exists solely to serve a millisecond window nobody has hit in use.
- The specs state the OS behavior as it stands instead of asserting FSEvents never drops an event.

### Negative

- An external edit landing inside the boot window goes unnoticed until the next edit touches the
  same file.
- The acceptance rests on desktop usage patterns. A future feature that writes config files from
  another process at boot must revisit this record and take the reconcile path.
