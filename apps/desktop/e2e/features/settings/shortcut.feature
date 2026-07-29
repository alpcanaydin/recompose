Feature: The settings shortcut

  Scenario: The shortcut brings settings into the open window
    Given the app is on the gateways screen
    When the maintainer presses the settings shortcut
    Then the main window shows the settings screen
    And the sidebar selection moves to Settings
    And focus lands on the first control

  Scenario: The shortcut opens a window when none stands open
    Given the menu bar switch is on and the last window is closed
    When the maintainer presses the settings shortcut
    Then a window opens on the settings screen

  Scenario: The shortcut never opens a second window
    Given the app is on the settings screen
    When the maintainer presses the settings shortcut
    Then one window stands open
