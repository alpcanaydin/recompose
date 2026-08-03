Feature: Verifying a stored key

  Background:
    Given the app is on the API Keys screen
    And a connected "Anthropic API" key named "build"

  Scenario: A key that authenticates says so as of the check
    Given the provider accepts the key
    When the maintainer verifies the key
    Then the surface reports that the key authenticates as of the check
    And nothing claims the account can spend

  Scenario: A turned-away key reads as not accepted, nothing more
    Given the provider no longer accepts the key
    When the maintainer verifies the key
    Then the surface reports that the provider didn't accept the key
    And the answer never guesses between a typo, a revocation, and an expiry

  Scenario: An unreachable provider leaves the question open
    Given the provider can't be reached
    When the maintainer verifies the key
    Then the surface reports that the check couldn't run
    And the row reads unverified rather than broken

  Scenario: No answer outlives the screen
    Given the maintainer has verified the key
    When the maintainer leaves the screen and returns
    Then no row carries the earlier answer
