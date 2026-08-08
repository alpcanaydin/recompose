# virtual-models Specification

## Purpose

The behavioral contract of a virtual model in recompose. It covers how a person defines one by a free name, bound to one stored account and one real model that account serves. It covers how the gateway lists the defined models on both dialects. It covers how a request under the virtual name reaches its target, or receives a typed refusal that names what's missing. Every stored account kind stands as a target, one definition binds one target, and no refusal falls back to another.

## Requirements

### Requirement: A virtual model maps to one target

A gateway MUST let a person define a virtual model by name and bind it to exactly one target: a stored account and one real model name that account serves. The gateway screen MUST list the defined models in the shipped row language, and adding one MUST take the gateway drawer over rather than opening a sheet. No definition holds a second target, a router, or a fallback in this contract.

#### Scenario: a person defines a virtual model

- When a person names a virtual model and picks a stored account and a real model on it
- Then the Models list holds the definition as one row
- And the row reads the virtual name over its target

### Requirement: The gateway lists its defined models

`GET /v1/models` MUST answer unauthenticated on loopback with the defined virtual models, serving both dialects. The Anthropic list shape and the OpenAI list shape each carry every model's id and display name. A defined model's `count_tokens` path MUST answer rather than a blanket 404.

#### Scenario: the listing names every defined model on both dialects

- Given a gateway holding two defined virtual models
- When a client asks the gateway for its model listing
- Then the listing names both models
- And it answers the same set in the Anthropic and the OpenAI shape

### Requirement: Every stored account stands as a target

The target picker MUST offer the subscription, key, aggregator, and local kinds alike. A stored definition naming any stored account MUST stand bound, so each request decides whether its target can answer, not the write.

#### Scenario: the picker offers every stored kind

- Given stored accounts of every kind
- When a person picks a target for a virtual model
- Then the picker lists the subscription, key, aggregator, and local accounts

#### Scenario: a stored subscription target stands bound

- Given a stored virtual model whose target names a subscription account
- When the gateway config loads
- Then the definition stands bound to the subscription account

### Requirement: The gateway proxies the virtual name to its target

A request arriving under a defined virtual model's name MUST forward to the target account's provider, carrying the target's real model name and the account's credential. The credential MUST NOT ride a command line, an environment variable, or a disk file on the way. A request under an undefined name, a missing target, or a missing credential MUST answer a typed refusal that names what's missing. The gateway MUST NOT fall back to another target on any refusal.

#### Scenario: a request under the virtual name reaches the target

- Given a gateway holding a virtual model bound to a stored key account
- When a request arrives under the virtual model's name
- Then the target's provider receives it under the target's real model name
- And the answer travels back to the caller

#### Scenario: an undefined name refuses with its reason

- When a request arrives under a name no virtual model carries
- Then the gateway answers a typed refusal naming the unknown model
- And no request leaves the machine

#### Scenario: a removed target refuses instead of falling back

- Given a virtual model whose target account left the registry
- When a request arrives under its name
- Then the gateway answers a typed refusal naming the missing target
- And nothing else receives the request
