Feature: First launch

  Scenario: A fresh install greets with the gateway empty state
    Given the app is on the gateways screen
    Then it offers to select a gateway or create one
