# ADR-0002: Gateway Engine Runs in Electron's utilityProcess

**Status**: Accepted
**Date**: 2026-07-21

## Context

The gateway engine (HTTP server, protocol translation, routing) must run alongside the UI. Options were a separate sidecar binary with its own runtime, or Electron's bundled Node.

## Decision

The engine runs on Electron's bundled Node inside a `utilityProcess`. It lives in an isolated pure-TS package (`packages/engine`) with zero `electron` imports.

## Alternatives

- **Bun sidecar (`bun build --compile`)**: faster runtime, but requires compiling, signing, and notarizing an extra binary per platform, plus spawn/crash/update lifecycle management. Bun's speed advantage is irrelevant for local, low-RPS proxy traffic — Node's `http` + SSE streaming is sufficient at `localhost` scale.

## Consequences

**Good**: no second runtime to package or notarize; single electron-builder chain; `utilityProcess` gives crash isolation and keeps the UI thread clean; plain Node messaging instead of cross-runtime IPC.

**Bad**: engine is capped at Electron's Node version. A future headless/CLI mode needs its own entry point — kept possible by the zero-`electron`-imports rule.
