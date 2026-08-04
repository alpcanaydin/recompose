Feature: The Local Runtimes catalog

  Background:
    Given the app is on the Local Runtimes screen

  Scenario: Adding a provider opens the catalog over the screen
    When the maintainer asks to add a provider
    Then the catalog opens over the screen, holding five entries
    And only "Ollama" answers a pick
    And the four that cannot connect yet stand under Soon badges
