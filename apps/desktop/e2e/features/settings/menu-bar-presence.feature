Feature: Menu bar presence

  Background:
    Given the app is on the settings screen

  Scenario: Turning the menu bar on shows a tray icon without a restart
    When the maintainer turns the menu bar switch on
    Then a tray icon stands in the menu bar

  Scenario: Turning the menu bar off takes the tray icon away
    Given the menu bar switch is on
    When the maintainer turns the switch off
    Then no tray icon stands in the menu bar

  Scenario: The app outlives its last window while the tray shows
    Given the menu bar switch is on
    When the maintainer closes the last window
    Then the app keeps running
    And the tray stays
