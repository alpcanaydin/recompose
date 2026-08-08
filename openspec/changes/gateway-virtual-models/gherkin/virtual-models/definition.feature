Feature: Defining a virtual model on a gateway

  A person names a virtual model and binds it to one stored target: an account
  and one real model that account serves. The definition stands as one row.

  Scenario: A person defines a virtual model bound to one target
    Given a gateway with a stored Anthropic key account
    When the person defines a virtual model "fast" targeting that account's "claude-sonnet-5"
    Then the Models list holds "fast" as one row
    And the row reads "fast" over its target

  Scenario: The person picks the real model rather than typing it
    Given a gateway with a stored Anthropic key account whose model list is reachable
    When the person picks that account as the target for a new virtual model
    Then the Model field offers the account's live model list
    And the field accepts no free-text model

  Scenario: An unreachable model list refuses in the sheet
    Given a gateway with a stored Anthropic key account whose model list is unreachable
    When the person picks that account as the target for a new virtual model
    Then the sheet reads a typed refusal naming the failed look
    And no definition is stored
