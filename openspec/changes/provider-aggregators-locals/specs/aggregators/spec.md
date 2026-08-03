# aggregators Specification

## ADDED Requirements

### Requirement: OpenRouter connects as an aggregator key

The Aggregators catalog MUST offer OpenRouter as a connectable entry. The entries that lack a contract MUST stand inert under a Soon badge rather than hidden: Together AI, Fireworks AI, Groq, DeepInfra, Cerebras, and a Custom aggregator escape hatch. A picked OpenRouter MUST ask for a name and a key in the anatomy the API Keys destination ships, and the stored account MUST take the `aggregator` kind.

#### Scenario: a person connects an OpenRouter key

- When a person picks OpenRouter in the catalog the Aggregators surface opened
- Then the form asks for a name and a key, and nothing more
- And the connected account lists under the Aggregators surface

### Requirement: An aggregator row claims no single host and offers no check

An aggregator row MUST read in the two-line key anatomy: the product title, then the name beside the masked tail. The row MUST NOT offer a Verify act, because no probe speaks for the many providers one aggregator key reaches.

#### Scenario: a connected aggregator reads as a key without a check

- When the surface lists a connected OpenRouter account
- Then the row reads the product over the name and the mask
- And no Verify act stands anywhere on or behind the row
