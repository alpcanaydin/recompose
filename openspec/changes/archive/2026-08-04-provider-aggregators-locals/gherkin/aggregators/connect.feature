Feature: Connecting an aggregator key

  Background:
    Given the app is on the Aggregators screen

  Scenario: A picked entry asks for a name and a key
    When the maintainer picks "OpenRouter" in the catalog
    Then the form asks for a name and a key
    And no field asks for a provider, a base URL, or a dialect

  Scenario: A connected key stands as one row under its product and its name
    When the maintainer connects an "OpenRouter" key named "build"
    Then the list holds one key, named "build" under "OpenRouter"
