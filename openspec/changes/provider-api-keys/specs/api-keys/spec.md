# api-keys

## Purpose

The behavioral contract of an API key account in recompose. It covers the catalog, what connecting asks and refuses, what a row reports, what the mask may reveal, and what verification claims. An API key is a secret one provider issues, and recompose holds it so a gateway can reach that provider with it, charged request by request.

## ADDED Requirements

### Requirement: A key account holds one provider's secret for a gateway to spend

An API key account records a secret one provider issued and the name a person gave it. The main process MUST keep the secret in the vault, and the secret MUST NOT reach the renderer. Removing the account MUST delete its vault entry with it. The surface MUST say what a key serves before a person connects one, rather than letting the first request teach it.

#### Scenario: a person reads what a key account serves

- When the API Keys surface lists a connected account
- Then the row names the product the key reaches
- And no part of the surface prints the stored secret

#### Scenario: removing the account removes the secret

- Given a connected key account
- When a person removes it
- Then the account leaves the list
- And its vault entry leaves with it

### Requirement: The catalog offers nine entries and connects two

The catalog the API Keys surface opens MUST offer nine entries: Anthropic API, OpenAI API, Gemini API, Mistral, xAI Grok, DeepSeek, Moonshot AI, Qwen, and Custom endpoint. Anthropic API and OpenAI API MUST connect. The other seven MUST stand inert under a Soon badge rather than hidden, because each lacks a field the account row can't hold yet. An inert entry MUST answer neither pointer nor keyboard, and its inertness MUST read as more than color and position. The one act into the catalog MUST stand at the trailing edge of the window strip.

#### Scenario: a person opens the catalog from the API Keys surface

- When a person asks to add a provider
- Then the catalog opens over the surface, holding nine entries
- And only Anthropic API and OpenAI API answer a pick

#### Scenario: an inert entry stays inert

- Given the catalog lists Gemini API under its Soon badge
- When a person tries the entry by pointer or by keyboard
- Then nothing opens
- And the entry reads as inert through more than color and position

### Requirement: Connecting asks for a name and a key

A picked entry MUST ask for a name and a key, and nothing more. The provider rides in from the picked entry, so the form MUST NOT ask for it, and MUST NOT offer a base URL or a dialect field. The surface MUST name the host the key reaches before a person stores it.

#### Scenario: a person picks a connectable entry

- When a person picks "Anthropic API" in the catalog the API Keys surface opened
- Then the form asks for a name and a key
- And no field asks for the provider, a base URL, or a dialect
- And the surface names the host the key reaches

### Requirement: A name stands once per provider

A connect whose name the same provider already holds MUST refuse with the existing `name-conflict` code. The refusal MUST land before any vault write, so a refused connect leaves no orphan credential. The name MUST trim before the comparison, so surrounding whitespace never makes a distinct name. Two providers MAY each hold a key of the same name, because the row's first line already names the product.

#### Scenario: a second key takes a name its provider already holds

- Given a connected Anthropic API key named "build"
- When a person connects another Anthropic API key named "build"
- Then the connect refuses with the `name-conflict` code
- And the vault holds nothing for the refused key

#### Scenario: two providers share a name

- Given a connected Anthropic API key named "build"
- When a person connects an OpenAI API key named "build"
- Then the account connects
- And each row stands under its own product title

### Requirement: The key's contents decide a refusal, never its shape

The pasted key MUST trim at the contract boundary, so surrounding whitespace never reaches the vault or a request header. A key holding an interior control character MUST draw a refusal that names the key's contents rather than its shape. A key whose shape suggests a different vendor MAY draw a warning and MUST still connect, because a shape refusal turns away legitimate keys.

#### Scenario: a key arrives with a trailing newline

- When a person pastes a key that ends in a newline and connects
- Then the stored secret holds none of the surrounding whitespace
- And the masked tail derives from the trimmed key

#### Scenario: a key carries a control character inside it

- When a person connects a key holding an interior control character
- Then the connect refuses
- And the refusal names the key's contents rather than its shape

#### Scenario: a key shaped like another vendor's still connects

- When a person connects a non-blank key whose beginning suggests a different vendor
- Then no shape refusal appears
- And the account connects

### Requirement: A row reports the product, the name, and the tail

A row MUST read as two lines: the product title its catalog entry carried, then the name beside the masked key tail, and nothing more. The mask MUST hold the last four characters of the trimmed key and MUST carry no vendor prefix. The main process MUST compute the mask at connect time and store it on the row as a non-secret field, so listing accounts never opens the vault.

#### Scenario: a connected key reads as two lines

- When the surface lists a connected key account
- Then the first line reads the product title
- And the second line reads the name beside the masked tail

#### Scenario: the mask reveals four characters and no prefix

- Given a stored key
- When its row shows the mask
- Then the mask holds the last four characters of the trimmed key
- And no vendor prefix stands in front of them

#### Scenario: listing accounts leaves the vault closed

- Given connected key accounts
- When the surface lists them
- Then every row reads from the account registry alone
- And no vault read happens

### Requirement: Verification answers a question and keeps no answer

A Verify act MUST let a person ask whether a stored key still authenticates, and it MUST NOT gate storing. The answer MUST be one of three: the key authenticates, the provider didn't accept the key, or the check couldn't run. The wording MUST speak as of the check, MUST NOT claim the account can spend, and MUST stay recompose's own rather than the provider's. The app MUST NOT store the answer: it lives only while the screen shows it, so no row carries a stale claim.

#### Scenario: a key passes the check

- Given a stored key the provider accepts
- When a person runs Verify
- Then the surface reports that the key authenticates as of the check
- And nothing claims the account can spend

#### Scenario: the provider turns the key away

- Given a stored key the provider no longer accepts
- When a person runs Verify
- Then the surface reports that the provider didn't accept the key
- And the report never guesses between a typo, a revocation, and an expiry

#### Scenario: the check can't run

- Given a provider the check can't reach
- When a person runs Verify
- Then the surface reports that the check couldn't run
- And the row reads unverified rather than broken

#### Scenario: no answer outlives the screen

- Given a verification answer on screen
- When a person leaves the surface and returns
- Then no row carries the earlier answer
