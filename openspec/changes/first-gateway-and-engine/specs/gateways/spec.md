# gateways

## Purpose

The behavioral contract of a gateway in recompose. It covers how a person creates one, what the app stores, how the app lists it, and what the app shows about whether it serves.

## ADDED Requirements

### Requirement: The empty state invites the first gateway

With no gateway stored, the canvas MUST present a single call to action reading "Create your first gateway" rather than an empty surface. The call to action MUST open the creation sheet.

#### Scenario: a person opens the app with no gateway stored

- When the canvas loads and no gateway exists
- Then the canvas shows the call to action
- And no gateway list renders in the sidebar

#### Scenario: a person triggers the call to action

- When a person activates "Create your first gateway"
- Then the creation sheet opens
- And focus lands on the name field

### Requirement: The creation sheet takes a name and a slug

The creation sheet MUST collect a display name and a slug, and nothing else. The sheet MUST NOT ask for a port, because the port belongs to settings and applies to every gateway at once. The sheet MUST reject a slug that breaks the slug format and a slug that a stored gateway already holds.

#### Scenario: a person saves a valid gateway

- When a person enters a display name and a free slug and saves
- Then the app stores a gateway document carrying that name and slug
- And the sheet closes

#### Scenario: a person enters a slug a gateway already holds

- When a person enters a slug that a stored gateway holds
- Then the app keeps the sheet open
- And the slug field names the conflict

#### Scenario: a person enters a slug the format rejects

- When a person enters a slug carrying an uppercase letter or a trailing dash
- Then the app refuses the save
- And the slug field states the format it accepts

### Requirement: The sheet previews the address the gateway serves

While the sheet stands open, it MUST show the address the gateway would answer on, built from the stored engine port and the slug in the field. The preview MUST follow every keystroke in the slug field.

#### Scenario: a person types a slug

- When a person types a slug into the sheet
- Then the preview reads the loopback address carrying the stored engine port and that slug

#### Scenario: the slug field stands empty

- When the slug field holds nothing
- Then the preview shows the address with the slug segment absent rather than a partial address

### Requirement: The sidebar lists gateways with their state

The sidebar MUST list every stored gateway. Each row MUST carry a status dot reporting whether the engine serves that gateway. The dot MUST distinguish running from stopped.

#### Scenario: a person saves the first gateway

- When a gateway saves
- Then the sidebar lists it
- And the canvas stops showing the call to action

#### Scenario: the engine stops

- When the engine reports that it stopped
- Then every gateway row shows the stopped state

### Requirement: A gateway exists before its first model

The gateway contract MUST accept a gateway carrying no virtual model, because a person creates a gateway before connecting a provider. A gateway carrying no virtual model MUST store, load, and list like any other.

#### Scenario: the app stores a gateway with no virtual model

- When a gateway with an empty virtual model list saves
- Then the app stores it
- And loading the stored document returns that gateway
