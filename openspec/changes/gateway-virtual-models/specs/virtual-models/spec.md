# virtual-models Specification

## ADDED Requirements

### Requirement: A virtual model maps to one target

A gateway MUST let a person define a virtual model by name and bind it to exactly one target: a stored account and one real model name that account serves. The gateway screen MUST list the defined models in the shipped row language, and adding one MUST run through a sheet. No definition holds a second target, a router, or a fallback in this contract.

#### Scenario: a person defines a virtual model

- When a person names a virtual model and picks a stored account and a real model on it
- Then the Models list holds the definition as one row
- And the row reads the virtual name over its target

### Requirement: A subscription account never stands as a target

The target picker MUST offer the key, aggregator, and local kinds and MUST NOT offer a subscription account. The stored definition MUST refuse a subscription target at parse, so the prohibition holds as a contract rather than a screen habit.

#### Scenario: the picker holds no subscription account

- Given stored accounts of every kind
- When a person picks a target for a virtual model
- Then the picker lists the key, aggregator, and local accounts
- And no subscription account stands anywhere in it

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
