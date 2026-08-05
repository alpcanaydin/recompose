Feature: A refusal renders in the arriving dialect

  Scenario: An unknown model refuses 404 in the arriving dialect's envelope
    Given a request naming a model no target holds
    When the library translates it
    Then the request meets a 404 refusal
    And the refusal renders in the arriving dialect's envelope

  Scenario: A dangling tool call repairs with a named fate
    Given a history carrying a tool call no tool result ever answered
    When the library translates it to the Anthropic shape
    Then the unanswered call leaves the history
    And the translation names the repair as that call's fate

  Scenario: An unrepairable dangling tool call refuses typed, naming the unmatched id
    Given a history whose dangling tool call the translation cannot honestly repair
    When the library translates it to the Anthropic shape
    Then the translation refuses typed
    And the refusal names the unmatched tool-call id

  Scenario Outline: A refusal renders in the arriving dialect's envelope
    Given a refusal arriving through a <dialect> client
    When the library renders the refusal
    Then it renders in the <dialect> error envelope

    Examples:
      | dialect                 |
      | Anthropic Messages      |
      | OpenAI Chat Completions |
      | OpenAI Responses        |
