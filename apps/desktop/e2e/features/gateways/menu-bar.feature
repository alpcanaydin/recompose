Feature: Gateways in the menu bar

  Background:
    Given recompose stands in the menu bar

  Scenario: A running gateway offers stop and restart
    Given a running gateway named "codex"
    When the maintainer opens the menu bar menu
    Then the "codex" submenu offers stop and restart
    And it shows start as unavailable

  Scenario: A stopped gateway offers start
    Given a stopped gateway named "codex"
    When the maintainer opens the menu bar menu
    Then the "codex" submenu offers start
    And it shows stop and restart as unavailable

  Scenario: Stopping from the menu bar carries to the sidebar
    Given a running gateway named "codex"
    When the maintainer chooses stop in the "codex" submenu
    Then "codex" stops answering
    And the sidebar shows "codex" as Stopped
