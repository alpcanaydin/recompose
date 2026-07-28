Feature: Theme

  Background:
    Given the app is on the settings screen

  Scenario: Choosing dark repaints the app at once
    When the maintainer switches the theme to dark
    Then the app repaints in dark without a restart

  Scenario: The chosen theme survives a restart
    Given the maintainer switched the theme to dark
    When the app restarts
    Then the app opens in dark
    And it never paints light first

  Scenario: The system theme follows the operating system
    Given the theme reads system
    When the operating system switches to dark
    Then the app repaints in dark without a restart
