# 0002: Gateway engine runs in Electron's utilityProcess

**Status**: Accepted
**Date**: 2026-07-21

## Context

The gateway engine (HTTP server, protocol translation, routing) must run alongside the UI. Options were a separate sidecar binary with its own runtime, or Electron's bundled Node.

## Decision

The engine runs on Electron's bundled Node inside a `utilityProcess`. It lives in an isolated pure-TS package (`packages/engine`) with zero `electron` imports.

## Alternatives

- **Bun sidecar (`bun build --compile`)**: faster runtime, but requires compiling, signing, and notarizing an extra binary per platform, plus spawn/crash/update lifecycle management. Bun's speed advantage is irrelevant for local proxy traffic with a low Requests Per Second (RPS) rate. Node's `http` and Server-Sent Events (SSE) streaming are sufficient at `localhost` scale.

## Consequences

**Good**: no second runtime needs packaging or notarizing. A single electron-builder chain covers the build. The `utilityProcess` gives crash isolation and keeps the UI thread clean. Plain Node messaging replaces cross-runtime Inter-Process Communication (IPC).

**Bad**: Electron's Node version caps the engine. A future headless/CLI mode still needs its own entry point, which the zero-`electron`-imports rule keeps possible.
