Feature: A subscription is a managed account

  Scenario: The row says what the account serves
    Given a connected "anthropic" subscription
    And the app is on the subscriptions screen
    Then the row names the plan product the account signs into
    And nothing on the screen offers the account as a gateway target

  Scenario: Signing in through the tool stores no credential recompose could route with
    Given a connected "anthropic" subscription
    Then the vault holds nothing for the account
    And the subscriptions catalog offers no key field
