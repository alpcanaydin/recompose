Feature: Provider accounts

  Background:
    Given the app is on the API Keys screen

  Scenario: A connected key stands as one row under its product and its name
    When the maintainer connects an "Anthropic API" key named "build"
    Then the list holds one key, named "build" under "Anthropic API"

  Scenario: Removing the only key brings back what a key serves
    Given a connected "Anthropic API" key named "build"
    When the maintainer removes the account
    Then the account leaves the list
    And a sentence names what a key serves
