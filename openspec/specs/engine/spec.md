# engine Specification

## Purpose

The behavioral contract of the process that answers for a gateway. It covers where a gateway listens and which callers its listener answers at all. It also covers what a request gets back before any provider connects, and how starting or stopping one gateway leaves every other one alone.

## Requirements

### Requirement: A gateway owns its listener and its port

Each gateway MUST answer on its own port rather than sharing one with its siblings. It MUST answer at `http://localhost:<port>`, the origin a person pastes into a client without adding a path. Every listener MUST bind the loopback interface and MUST NOT bind any other interface, because recompose fronts paid accounts and a wider bind exposes them. Two gateways MUST NOT hold the same port.

#### Scenario: a person starts one gateway

- When a person starts a gateway
- Then a listener answers on that gateway's port on the loopback interface
- And no other gateway's state changes

#### Scenario: two gateways run at once

- When two gateways run
- Then each answers on its own port
- And a request to one never reaches the other

### Requirement: A gateway serves at the root of its own address

A gateway MUST answer at the root of its address rather than under a name-shaped path segment. The address a person copies MUST work as the base URL of a client without an added path.

#### Scenario: a client points at a gateway

- When a client sets its base URL to a running gateway's address
- Then the request the client sends reaches that gateway

### Requirement: The health path answers for real

Each gateway MUST answer a health path with a real response rather than a placeholder, because the health path proves the listener answers before any provider exists.

#### Scenario: a person checks a gateway's health

- When a request arrives at a running gateway's health path
- Then the engine answers with a success carrying that gateway's name

### Requirement: A model request answers with a typed refusal

While a gateway carries no virtual model, a model request against it MUST answer with a typed refusal that names the missing model. Failing at the transport or returning an empty body MUST NOT happen. The refusal MUST carry a shape a client can read.

#### Scenario: a model request reaches a gateway with no model

- When a model request arrives for a running gateway carrying no virtual model
- Then the engine answers with a typed refusal
- And the refusal names the gateway and states that it holds no model

### Requirement: A taken port fails one gateway alone

A gateway whose port another process already holds MUST fail to start, and the report MUST name the port. That failure MUST leave every other gateway untouched, and a second start attempt after the port frees MUST succeed.

#### Scenario: another process holds the port

- When a person starts a gateway whose port another process holds
- Then that gateway reports that it failed to start
- And the report names the port
- And every other running gateway keeps serving

#### Scenario: a person retries after the port frees

- When the port frees and a person starts the gateway again
- Then the gateway serves

### Requirement: The engine reports each gateway's state

The engine MUST report per-gateway running and stopped state to the main process, and the main process MUST carry that state to the screen. The screen MUST drive start and stop for one gateway at a time.

#### Scenario: a person stops one gateway of two

- When a person stops one of two running gateways
- Then that gateway stops answering
- And the app shows it as stopped
- And the other gateway keeps serving

#### Scenario: a gateway arrives while its siblings run

- When a person saves a new gateway while other gateways run
- Then the new gateway starts serving on its own port
- And no running gateway restarts
