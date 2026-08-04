# dialect-translation Specification

## ADDED Requirements

### Requirement: A request translates whole, and no field drops without a trace

The library MUST translate an Anthropic Messages request into an OpenAI Chat Completions request and back. The translation carries the system prompt, the content blocks, the tool definitions, the tool choice, and the images. Every field on the source MUST meet one of three fates the translation names: carried as is, mapped to the other dialect's shape, or refused typed. A field the translation can't carry MUST never vanish without a trace. A tool schema of bare object type MUST normalize to the shape providers requiring properties accept.

#### Scenario: a tool-calling request crosses to the other dialect

- Given an Anthropic request carrying a system prompt, tool definitions, and a tool choice
- When the library translates it for an OpenAI target
- Then the tools, the choice, and the system prompt stand in the OpenAI shape
- And nothing the source carried has vanished without a named fate

#### Scenario: a bare object schema normalizes

- Given a tool whose input schema is a bare object type with no properties
- When the request translates to the OpenAI shape
- Then the schema carries an explicit empty properties object

### Requirement: A response translates whole, including the stops

The library MUST translate a response between the dialects, carrying the text, the tool calls, the stop reason, and the usage counts. The stop reason MUST map to the other dialect's vocabulary, and an unmappable reason MUST refuse typed rather than default.

#### Scenario: a tool-call answer crosses back

- Given an OpenAI response answering with a tool call and usage counts
- When the library translates it to the Anthropic shape
- Then the tool call, the stop reason, and the usage stand in the Anthropic shape

### Requirement: The stream translates event for event

The library MUST translate a streaming answer between the dialects as it arrives. OpenAI chat chunks and Anthropic message events map to one another, tool-call streaming included, and the translated stream MUST end the way the source ended. A tool-call block start MUST carry its tool's name, because a client acting on the stream breaks on a nameless block.

#### Scenario: a streamed tool call keeps its name

- Given an OpenAI stream whose chunks assemble a tool call
- When the library translates the stream to Anthropic events
- Then the tool call's block start carries the tool's name
- And the events end the way the source stream ended

#### Scenario: a mid-stream failure crosses as a failure

- Given a source stream that ends in the dialect's error shape
- When the library translates it
- Then the translated stream ends in the other dialect's error shape
- And no synthetic success stands after the failure
