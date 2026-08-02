Feature: The provider catalog

  Background:
    Given the app is on the subscriptions screen

  Scenario: Adding a provider opens the catalog beside the screen
    When the maintainer asks to add a provider
    Then the catalog opens beside the screen rather than replacing it
    And it lists the providers grouped by kind
    And it offers a search field

  Scenario: Narrowing the catalog to one kind
    Given the catalog is open
    When the maintainer narrows it to subscriptions
    Then only the subscription providers remain listed

  Scenario: A provider offering both ways names what each yields
    Given the catalog is open
    When the maintainer picks "anthropic"
    Then both ways of connecting stand together
    And the sign-in says it yields an account for the provider's own tool
    And the key says it yields a target a gateway can reach
