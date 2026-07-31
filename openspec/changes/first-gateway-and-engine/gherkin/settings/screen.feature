Feature: The settings screen

  Background:
    Given the app is on the settings screen

  Scenario: The screen groups every setting into four sections
    Then the screen groups its settings under General, Server, Appearance, and Data in that order

  Scenario: A change applies without a save action
    When the maintainer switches the theme to dark
    Then the app repaints in dark
    And the screen offers no save, apply, or cancel action

  Scenario: A change leaves the maintainer where they were
    When the maintainer switches the theme to dark
    Then focus stays on the theme control
    And the app neither navigates nor opens a window

  Scenario: A rejected write returns the control to the stored value
    Given the settings document cannot be written
    When the maintainer switches the theme to dark
    Then the theme returns to system
    And the row states that the change was not saved

  Scenario: Two changes in quick succession both survive
    When the maintainer switches the theme to dark
    And shows recompose in the menu bar straight after
    Then the stored settings hold the dark theme and the menu bar presence

  Scenario: The Server group offers no port
    Then the Server group offers no port control
    And the stored settings document holds no port

  Scenario: The bind address states a value rather than offering a control
    Then the bind address row reads "127.0.0.1"
    And the row states that recompose never serves the network

  Scenario: Telemetry states a value rather than offering a control
    Then the telemetry row reads "None"
    And the row states that recompose never phones home
