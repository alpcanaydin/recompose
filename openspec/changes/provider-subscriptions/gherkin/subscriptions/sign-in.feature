Feature: Signing in through the provider's own tool

  Background:
    Given the app is on the subscriptions screen

  Scenario: The provider's own tool performs the sign-in
    Given the "anthropic" command-line tool is installed
    When the maintainer connects an "anthropic" subscription by signing in
    Then the app hands the sign-in to the provider's own tool
    And the account appears once that tool reports success

  Scenario: An absent tool is a stated reason
    Given the "anthropic" command-line tool isn't installed
    When the maintainer chooses to sign in to "anthropic"
    Then the surface names the missing tool and what to do about it
    And no sign-in begins
