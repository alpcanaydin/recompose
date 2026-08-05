Feature: A stream crosses the dialects event for event

  Scenario: A streamed tool call keeps its name on the block start
    Given an OpenAI stream whose chunks assemble a tool call
    When the library translates the stream to Anthropic events
    Then the tool call's block start carries the tool's name

  Scenario: A cleanly ended source stream ends the translated stream cleanly too
    Given an OpenAI stream that completes cleanly
    When the library translates the stream to Anthropic events
    Then the translated events end in the Anthropic terminator, the way the source ended

  Scenario: A mid-stream failure crosses as a failure with no synthetic success after it
    Given a source stream that ends in its dialect's error shape
    When the library translates it
    Then the translated stream ends in the other dialect's error shape
    And no synthetic success stands after the failure

  Scenario: An unknown event type passes through without ending the stream
    Given an upstream stream carrying an event type the library does not recognize
    When the library translates the stream
    Then the unknown event passes through without ending the stream
    And the stream runs on to its own end

  Scenario: A tool call whose upstream omitted its index still arrives with a stable id
    Given an OpenAI stream whose tool-call chunks omit their index
    When the library translates the stream to Anthropic events
    Then the tool call arrives with a stable id

  Scenario: Text before a tool call keeps correct block indices
    Given an OpenAI stream carrying text before a tool call
    When the library translates the stream to Anthropic events
    Then the text block and the tool-call block each carry their own correct index
