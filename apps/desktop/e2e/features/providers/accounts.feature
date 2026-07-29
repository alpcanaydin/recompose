Feature: Provider accounts

  Scenario: Connecting the first account lists it
    Given the app is on the providers screen
    When the maintainer connects an "anthropic" api-key account labeled "Work"
    Then the providers list shows the "Work" account for "anthropic"

  Scenario: Removing the only account empties the list
    Given the app is on the providers screen
    And a connected "anthropic" api-key account labeled "Work"
    When the maintainer removes the "Work" account
    Then the providers list is empty
