Feature: A subscription is a managed account

  Background:
    Given a connected "anthropic" subscription

  Scenario: The row says what the account serves
    Given the app is on the subscriptions screen
    Then the row names the plan product the account signs into
    And nothing on the screen offers the account as a gateway target

  Scenario: A virtual model never offers a subscription target
    Given a gateway named "codex" exists
    When the maintainer composes a virtual model for "codex"
    Then the offered targets carry no subscription account
