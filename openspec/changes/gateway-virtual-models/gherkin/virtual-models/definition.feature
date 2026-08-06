Feature: Defining a virtual model on a gateway

  A person names a virtual model and binds it to one stored target: an account
  and one real model that account serves. The definition stands as one row.

  Scenario: A person defines a virtual model bound to one target
    Given a gateway with a stored key account
    When the person names a virtual model and picks the account and a real model it serves
    Then the Models list holds the definition as one row
    And the row reads the virtual name over its target

  Scenario: The person picks the real model rather than typing it
    Given a gateway with a stored key account whose live model list is reachable
    When the person opens the add-model sheet and picks the account
    Then the Model field offers the account's live model list
    And the field accepts no free-text model

  Scenario: An unreachable model list refuses in the sheet
    Given a gateway with a stored key account whose live model list is unreachable
    When the person opens the add-model sheet and picks the account
    Then the sheet reads a typed refusal naming the failed look
    And the definition never reaches disk
