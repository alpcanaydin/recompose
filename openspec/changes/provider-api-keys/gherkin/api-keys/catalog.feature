Feature: The key catalog

  Background:
    Given the app is on the API Keys screen

  Scenario: Adding a provider opens the catalog over the screen
    When the maintainer asks to add a provider
    Then the catalog opens over the screen, holding nine entries
    And only "Anthropic API" and "OpenAI API" answer a pick
    And the seven that cannot connect yet stand under Soon badges

  Scenario: An inert entry answers neither pointer nor keyboard
    Given the catalog is open
    When the maintainer tries "Gemini API" by pointer and by keyboard
    Then nothing opens
    And the entry reads as inert through more than color and position

  Scenario: One act leads into the catalog
    Then the act that adds a provider stands at the trailing edge of the window strip
