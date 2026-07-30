Feature: Running a gateway from the screen

  Background:
    Given the app is on the gateways screen

  Scenario: A gateway serves the moment it saves
    When the maintainer creates the gateway "codex" on the offered port
    Then the sidebar shows "codex" as Running
    And "codex" answers at the address the toolbar shows

  Scenario: A port lost between the offer and the save stores a stopped gateway
    Given the creation sheet is open
    And another process has taken the offered port
    When the maintainer creates the gateway "codex" on the offered port
    Then the sidebar shows "codex" as Stopped
    And a message names the taken port

  Scenario: Two gateways in different states read differently
    Given a running gateway named "codex"
    And a stopped gateway named "gemini"
    Then the sidebar shows "codex" as Running
    And the sidebar shows "gemini" as Stopped

  Scenario: Starting the selected gateway serves it
    Given a stopped gateway named "codex"
    When the maintainer starts "codex" from the toolbar
    Then the sidebar shows "codex" as Running
    And "codex" answers at the address the toolbar shows

  Scenario: A start against a taken port offers a move
    Given a stopped gateway named "codex"
    And another process has taken the port that "codex" holds
    When the maintainer starts "codex" from the toolbar
    Then the sidebar shows "codex" as Stopped
    And a message names the taken port
    And the app offers "Move to a free port"
