Feature: Starting and stopping gateways

  Background:
    Given the app is on the gateways screen

  Scenario: Starting one gateway leaves its sibling alone
    Given a stopped gateway named "codex"
    And a stopped gateway named "gemini"
    When the maintainer starts "codex" from the toolbar
    Then "codex" answers at its own address
    And "gemini" stays stopped

  Scenario: Stopping one of two leaves the other serving
    Given a running gateway named "codex"
    And a running gateway named "gemini"
    When the maintainer stops "codex" from the toolbar
    Then "codex" stops answering
    And the sidebar shows "codex" as Stopped
    And "gemini" keeps serving

  Scenario: A taken port fails one gateway alone
    Given a running gateway named "gemini"
    And a stopped gateway named "codex"
    And another process has taken the port that "codex" holds
    When the maintainer starts "codex" from the toolbar
    Then a message names the taken port
    And "gemini" keeps serving

  Scenario: A retry serves once the port frees
    Given a stopped gateway named "codex"
    And a start that failed while another process held its port
    When the port frees and the maintainer starts "codex" again
    Then "codex" answers at its own address

  Scenario: A gateway saved while its siblings run restarts nothing
    Given a running gateway named "codex"
    When the maintainer creates the gateway "gemini" on the offered port
    Then "gemini" answers at its own address
    And "codex" keeps serving
