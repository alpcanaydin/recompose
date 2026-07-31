Feature: First launch

  Scenario: A fresh install offers the first gateway
    Given the app is on the gateways screen
    Then the app offers "Create Gateway"
