Feature: The provider catalog

  Background:
    Given the app is on the subscriptions screen

  Scenario: Adding a provider opens the catalog over the screen
    When the maintainer asks to add a provider
    Then the catalog opens over the screen, holding only subscription plans
    And the plans that cannot connect yet stand disabled

  Scenario: Picking a provider offers the one way the screen holds
    Given the catalog is open
    When the maintainer picks "anthropic"
    Then the sign-in stands alone, yielding an account for the provider's own tool
