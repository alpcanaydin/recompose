# recompose

Wire up your own AI network.

recompose is an open-source, offline-first desktop app that composes your AI providers into local gateways. You wire virtual models to real providers on a node canvas; your clients (Claude Code, Codex, Cursor) talk to one local endpoint and never learn what runs behind it.

> [!IMPORTANT]
> recompose is in early development and is being built UI-first: the interface comes together before the gateway engine. Nothing is usable yet.

## How it works

A gateway is a running local server. On its canvas you wire three kinds of nodes between the endpoint and your accounts:

```
Claude Code ──▶ http://localhost:8397/my-gateway
                        │
                 [ virtual model "fast" ]
                        │
                 [ router: failover ]
                   #1 │        #2 │
        [ Claude · sonnet ]  [ OpenAI · gpt-5 ]
```

- **Providers**: every connected AI source in one place. Sign in with OAuth (Claude and Codex subscriptions), or add any OpenAI-compatible or Anthropic-compatible endpoint with a base URL and key. Local runtimes (Ollama, LM Studio) come later.
- **Virtual models**: the aliases your clients see, such as `fast` or `smart`. The real model behind an alias stays hidden, so you can swap it without touching a single client config.
- **Routers**: pick a mode per router. Failover sends traffic to the topmost healthy target; round-robin spreads it across a pool. Chain routers to combine strategies, for example a failover whose first slot feeds a round-robin pool.
- **Gateways**: each gateway is a path on one local port and always serves both API dialects, `/v1/messages` (Anthropic) and `/v1/chat/completions` (OpenAI). The request path disambiguates; there is no per-gateway protocol choice.

## Signature: live traffic on the wires

The canvas shows routing health in real time. Green dots flow along the wires while clients use the gateway. When a target rate-limits, its wire goes dashed with a red mark and the flow visibly shifts to the standby target: failover as a visual story, not a log line.

## Offline-first

- No signup. Credentials never leave your machine; the config lives in `~/.recompose`.
- No telemetry. recompose never phones home.
- Serving on LAN is opt-in and sits behind a local API token, because your gateways front paid accounts.

## Connect a client

Each gateway's Connect tab gives copy-ready snippets per client. The manual version is one variable:

```sh
export ANTHROPIC_BASE_URL=http://localhost:8397/my-gateway
```

OpenAI-dialect clients use `OPENAI_BASE_URL` against the same address. For detected clients, recompose can write the config file for you, with undo.

## Development

Requires Node 22+ and pnpm 11.

```sh
pnpm install
pnpm dev
```

| Path           | What lives there                       |
| -------------- | -------------------------------------- |
| `apps/desktop` | Electron app (main, preload, renderer) |
| `docs/adr`     | Architecture decision records          |

The Electron shell hosts the UI; the gateway engine runs in a `utilityProcess` as a pure TypeScript package with no `electron` imports. Every technical decision is recorded in [docs/adr](docs/adr/README.md).
