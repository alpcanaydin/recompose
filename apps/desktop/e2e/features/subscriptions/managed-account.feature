Feature: A subscription is a managed account

  Scenario: The row says what the account serves
    Given a connected "anthropic" subscription
    And the app is on the subscriptions screen
    Then the row states the account serves the provider's own tool
    And nothing on the screen offers the account as a gateway target

  Scenario: Signing in through the tool stores no credential recompose could route with
    Given a connected "anthropic" subscription
    Then the vault holds nothing for the account
    And the way that yields a gateway target asks for a key rather than a sign-in
