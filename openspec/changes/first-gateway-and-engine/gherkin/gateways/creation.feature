Feature: Creating a gateway

  Background:
    Given the app is on the gateways screen

  Scenario: A fresh install invites the first gateway
    Then the screen invites "Create your first gateway"
    And the sidebar lists no gateway

  Scenario: The call to action opens the creation sheet
    When the maintainer chooses "Create Gateway"
    Then the "Create a gateway" sheet opens
    And the name field holds focus

  Scenario: A later gateway starts from the sidebar
    Given a gateway named "codex" exists
    When the maintainer asks for a new gateway from the sidebar
    Then the "Create a gateway" sheet opens

  Scenario: The keyboard reaches the creation sheet
    When the maintainer presses the shortcut for a new gateway
    Then the "Create a gateway" sheet opens

  Scenario: Accepting the sheet's offer stores the gateway
    When the maintainer creates the gateway "Codex" with the slug "codex", leaving the port alone
    Then the stored gateway carries the name "Codex", the slug "codex", and the offered port

  Scenario: A typed port beats the offered one
    When the maintainer creates the gateway "codex" on a free port they typed themselves
    Then the stored gateway "codex" carries the typed port

  Scenario: A gateway stores, loads, and lists before its first model
    Given a gateway named "codex" exists
    When the app restarts
    Then the sidebar lists "codex"
