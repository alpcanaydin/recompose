# engine

## Purpose

The behavioral contract of the recompose engine. It covers the loopback server on the stored port and how that server separates one gateway from another. It also covers what the server answers before a provider connects, and how the app learns whether it runs.

## ADDED Requirements

### Requirement: One server on the stored port

The engine MUST run one HTTP server for every gateway rather than one server per gateway. The server MUST bind the loopback interface and the port the settings document holds. Binding any other interface MUST NOT happen, because recompose fronts paid accounts and a wider bind exposes them.

#### Scenario: the engine starts

- When a person starts the engine
- Then one server listens on the loopback interface at the stored port

#### Scenario: the port is already taken

- When the stored port is already bound by another process
- Then the engine reports that it failed to start
- And the report names the port

### Requirement: The first path segment selects the gateway

The engine MUST read the first path segment of a request as a gateway slug and route the request to that gateway. A request naming a slug that no gateway holds MUST answer with a refusal that names the unknown slug.

#### Scenario: a request names a stored gateway

- When a request arrives at the path carrying a stored gateway's slug
- Then the engine handles it as that gateway's request

#### Scenario: a request names an unknown gateway

- When a request arrives carrying a slug that no gateway holds
- Then the engine answers with a refusal naming the unknown slug

### Requirement: The health path answers for real

Each gateway MUST answer its health path with a real response rather than a placeholder, because the health path proves the server routes before any provider exists.

#### Scenario: a person checks a gateway's health

- When a request arrives at a stored gateway's health path
- Then the engine answers with a success carrying that gateway's slug

### Requirement: A model request answers with a typed refusal

While a gateway carries no virtual model, a model request against it MUST answer with a typed refusal that names the missing model. Failing at the transport or returning an empty body MUST NOT happen. The refusal MUST carry a shape a client can read.

#### Scenario: a model request reaches a gateway with no model

- When a model request arrives for a gateway carrying no virtual model
- Then the engine answers with a typed refusal
- And the refusal names the gateway and states that it holds no model

### Requirement: The engine reports its lifecycle to the app

The engine MUST report running and stopped state to the main process, and the main process MUST carry that state to the screen. The screen MUST drive start and stop.

#### Scenario: a person starts the engine from the screen

- When a person starts the engine from the screen
- Then the app shows the running state once the server listens

#### Scenario: a person stops the engine from the screen

- When a person stops the engine from the screen
- Then the server stops listening
- And the app shows the stopped state
