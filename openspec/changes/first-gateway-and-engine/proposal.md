# The first gateway and the engine that serves it

## Why

recompose holds a gateway contract and two channels that carry gateway documents across the process boundary. Nothing creates a gateway, nothing lists one, and no server answers a request at the port the settings screen already stores. The canvas route renders a placeholder.

This change closes the loop end to end. A person creates a gateway from an empty state and sees it in the sidebar with a status dot. Starting the engine from the screen brings a real answer back from the health path. No provider connects yet. A model request answers with a typed refusal that names the missing piece rather than failing at the transport.

## What changes

- The gateway canvas empty state gains a "Create your first gateway" call to action.
- A creation sheet takes a display name and a slug, and nothing else. The sheet never asks for a port, because the port lives in settings.
- The sheet carries a live preview reading `http://localhost:PORT/SLUG`, where the port comes from the stored settings document.
- The sidebar lists every saved gateway with a status dot that reports running or stopped.
- A new engine package holds one loopback HTTP server. It binds the port from settings, separates gateways by the first path segment, and answers a health path for real.
- A model request against a gateway with no virtual model answers with a typed refusal rather than a transport failure.
- The engine reports running and stopped state to the main process, and the screen drives start and stop.
- `gatewayConfigSchema` accepts an empty `virtualModels` array, because a gateway exists before its first model does.

## Capabilities

### New capabilities

- `gateways`: a person creates, names, and lists a gateway, and the app shows whether the engine serves it.
- `engine`: one loopback HTTP server answers on the stored port, separates gateways by slug, and reports its lifecycle to the app.

### Modified capabilities

None.

## Impact

- The gateway contract stops requiring at least one virtual model. Every consumer that reads `virtualModels[0]` faces an empty array.
- The workspace gains a package. The engine runs without Electron, so it stays testable without a desktop harness.
- The settings screen's engine port stops being a stored value nothing reads.
