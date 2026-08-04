Feature: The Aggregators catalog

  Background:
    Given the app is on the Aggregators screen

  Scenario: Adding a provider opens the catalog over the screen
    When the maintainer asks to add a provider
    Then the catalog opens over the screen, holding seven entries
    And only "OpenRouter" answers a pick
    And the six that cannot connect yet stand under Soon badges
