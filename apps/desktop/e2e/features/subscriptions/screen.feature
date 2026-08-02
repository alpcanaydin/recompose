Feature: The subscriptions screen

  Background:
    Given the app is on the subscriptions screen

  Scenario: Nothing connected explains what a subscription is
    Then the screen offers one call to action
    And a sentence names what a subscription account is
    And no account list renders

  Scenario: A connected account reads as connected
    Given a connected "anthropic" subscription signed in as "dev@example.com" on the "Max" plan
    Then the row carries the provider's mark, the product name, the "Max" plan, and "dev@example.com"
    And the standing reads "Connected" with a mark beside the word

  Scenario: A lapsed account carries its own way back
    Given a connected "anthropic" subscription whose authorization lapsed
    Then the row reports the lapse rather than "Connected"
    And the row itself offers the way to restore the account
