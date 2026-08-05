Feature: A response crosses the dialects, stops and all

  Scenario: A tool-call answer crosses back to Anthropic with its call, stop reason, and usage intact
    Given an OpenAI response answering with a tool call and usage counts
    When the library translates it to the Anthropic shape
    Then the tool call, the stop reason, and the usage stand in the Anthropic shape

  Scenario: An unmappable stop reason refuses typed rather than defaulting
    Given a response whose stop reason names a server-tool pause the target dialect cannot express
    When the library translates it
    Then the translation refuses typed
    And it does not silently default the stop reason to a near match

  Scenario: A refusal reaches an OpenAI client as a 200 with the loss recorded
    Given an Anthropic response whose stop reason is a refusal
    When the library translates it for an OpenAI-dialect client
    Then the client receives a 200 answer carrying a documented finish reason
    And the translation records the lossy mapping

  Scenario: a reasoning item crosses to a thinking block
    Given a Responses request whose history carries a reasoning item with a compatible signature
    When the library translates it to the Anthropic shape
    Then the reasoning stands as a thinking block carrying its signature
    And a foreign-provider signature drops rather than crossing as a fabricated one
