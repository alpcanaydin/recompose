Feature: The API keys screen

  Background:
    Given the app is on the API Keys screen

  Scenario: Nothing connected explains what a key is
    Then a sentence names what a key serves
    And no account list renders

  Scenario: A connected key reads as two lines
    Given a connected "Anthropic API" key named "build"
    Then the row's first line reads "Anthropic API"
    And the row's second line reads "build" beside the masked tail

  Scenario: The mask shows four characters and no vendor prefix
    Given a connected "Anthropic API" key ending in "7f2c"
    Then the masked tail reads exactly "7f2c"
    And no vendor prefix stands in front of it

  Scenario: The stored secret never reaches the screen
    Given a connected "Anthropic API" key named "build"
    Then no part of the screen prints the stored key

  Scenario: Removing a key removes its secret
    Given a connected "Anthropic API" key named "build"
    When the maintainer removes the account
    Then the account leaves the list
    And the vault holds nothing for the account
