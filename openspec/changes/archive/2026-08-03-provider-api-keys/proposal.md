# Provider keys, and the screen that lists them

## Why

The providers surface promises four destinations, and only Subscriptions keeps that promise in full. Its API Keys neighbor still lists accounts through a placeholder row, and its connect form names every account after its vendor. The page subtitle already says what a key is for: keys a gateway reaches one provider with, charged request by request. This change makes the destination live up to that sentence, in the design language the shipped Subscriptions destination set.

A key also deserves a contract of its own. A subscription credential belongs to the provider's own tool, and the subscriptions contract says so. A key is the one credential recompose holds and spends itself, so its contract must state what the app stores, shows, refuses, and claims.

## What changes

**The catalog offers nine entries, and two of them connect.** Anthropic API and OpenAI API take a key today, because each has one first-party host a hard-coded client can hold. Gemini API, Mistral, xAI Grok, DeepSeek, Moonshot AI, Qwen, and Custom endpoint stand inert under Soon badges. Each of the seven lacks something the account row can't hold yet: a base URL, a dialect choice, or another auth header. An inert entry stands visible rather than hidden, so the catalog says where it grows.

**Connecting asks for a name and a key, nothing else.** The provider rides in from the picked entry. The pasted key trims at the contract boundary, so a trailing newline never reaches the vault or a request header. A key holding an interior control character draws a refusal that names the key's contents rather than its shape. A key shaped like another vendor's may draw a warning and still connects, because a shape refusal turns away legitimate keys.

**A repeated name under one provider draws the existing `name-conflict` refusal.** The refusal lands before any vault write, so a refused connect leaves no orphan credential. Two providers may each hold a key of the same name, because the row's first line already names the product.

**A row reads as two lines with a four-character tail.** The product title stands first, then the name beside the masked key tail. The main process computes the mask from the trimmed key at connect time and stores it on the row as a non-secret field. Listing accounts never opens the vault, and the mask carries no vendor prefix.

**Verify is an act, never a gate.** A person may ask whether a stored key still authenticates. The answer is one of three: the key authenticates, the provider didn't accept it, or the check couldn't run. The wording speaks as of the check and never claims the account can spend. The app stores no answer, so no row carries a stale claim.

**The way into the catalog stays put.** The one act stands where it already stands, at the trailing edge of the window strip.

**What this change leaves out, on purpose.**

- No stored standing on a key row: a verification answer dies with the screen, so no row carries a stale claim.
- No replace-key act ships in this release.
- No base URL and no dialect field: those two fields are what the seven inert entries wait on.
- The seven inert providers stay inert: each waits under its Soon badge until the row learns the fields it lacks.

## Capabilities

### New capabilities

- `api-keys`: what a key account holds and serves, what the catalog offers, what connecting asks and refuses, what a row and its mask reveal, and what verification claims and never claims.

### Modified capabilities

- `subscriptions`: one sentence changes. The shipped spec reads `A key pick MUST ask for the key alone`, and the name field this change adds contradicts it. That amendment belongs to this change's scope: a key pick asks for a name and a key, and the provider still rides in from the picked entry.

## Impact

- `apps/desktop/src/renderer/src/pages/providers/` gains the nine-entry key catalog, the name field on the connect form, the two-line key row, and the Verify act.
- `packages/contracts` adds the mask to the account row, which moves `ACCOUNTS_VERSION` past 2 with a migration, and trims the secret at the boundary.
- The main process computes the mask, refuses a repeated name before the vault write, and answers the verification question in recompose's own words.
- `openspec/specs/subscriptions/spec.md` changes one sentence, named above.
- The e2e providers feature and the visual baselines that show a connected account change with the new row.
