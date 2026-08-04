Feature: The aggregator account row

  Background:
    Given the app is on the Aggregators screen

  Scenario: A connected aggregator reads as a key without a check
    Given a connected "OpenRouter" key named "build"
    Then the row's first line reads "OpenRouter"
    And the row's second line reads "build" beside the masked tail
    And no Verify act stands anywhere on or behind the row
