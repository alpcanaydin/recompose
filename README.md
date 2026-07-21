# recompose

Wire up your own AI network.

recompose is a free, open-source desktop app that composes your AI providers into local gateways. You define virtual models, wire them to real providers on a node canvas, and point clients such as Claude Code, Codex, and Cursor at one local endpoint.

> [!IMPORTANT]
> recompose is in early development. There are no releases yet.

## Features

- **One endpoint for every client**: each gateway serves both API dialects on a single base URL, `/v1/messages` (Anthropic) and `/v1/chat/completions` (OpenAI). The request path disambiguates; there is nothing to configure per client.
- **Virtual models**: clients see aliases such as `fast` or `smart`. Swap the real model behind an alias without touching a single client config.
- **Composable routing**: failover ladders send traffic to the topmost healthy target; round-robin pools spread it evenly or by weight. Chain routers to combine strategies.
- **Any provider**: sign in with OAuth for Claude and Codex subscriptions, or add any OpenAI-compatible or Anthropic-compatible endpoint with a base URL and key. Local runtimes (Ollama, LM Studio) are planned.
- **Offline-first and private**: no signup, no telemetry. Credentials stay on your machine in `~/.recompose`. Serving on LAN is opt-in and sits behind a local API token.

## How it works

A gateway is a running local server. Its canvas wires virtual models through routers to provider targets:

```
Claude Code ──▶ http://localhost:8397/my-gateway
                        │
                 [ virtual model "fast" ]
                        │
                 [ router: failover ]
                   #1 │        #2 │
        [ Claude · sonnet ]  [ OpenAI · gpt-5 ]
```

Clients connect through an environment variable:

```sh
export ANTHROPIC_BASE_URL=http://localhost:8397/my-gateway
```

OpenAI-dialect clients set `OPENAI_BASE_URL` to the same address.

## Building from source

Requires Node 22+ and pnpm 11.

```sh
pnpm install
pnpm dev
```

| Path           | What lives there                       |
| -------------- | -------------------------------------- |
| `apps/desktop` | Electron app (main, preload, renderer) |
| `docs/adr`     | Architecture decision records          |

## Architecture

The Electron shell hosts the UI; the gateway engine runs in a `utilityProcess` as a pure TypeScript package with no `electron` imports, keeping a future headless mode possible. Every technical decision is recorded in [docs/adr](docs/adr/README.md).
