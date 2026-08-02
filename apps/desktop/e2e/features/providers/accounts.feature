Feature: Provider accounts

  Scenario: Connecting the first account lists it
    Given the app is on the providers screen
    When the maintainer connects an "anthropic" api-key account
    Then the providers list shows the "Anthropic" account for "anthropic"

  Scenario: Removing the only account empties the list
    Given the app is on the providers screen
    And a connected "anthropic" api-key account
    When the maintainer removes the "Anthropic" account
    Then the providers list is empty
