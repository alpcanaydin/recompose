Feature: Launch at login

  Scenario: Linux never offers a launch-at-login row
    Given the app runs on Linux
    When the app opens the settings screen
    Then the screen carries no launch-at-login row

  Scenario: A development build offers the row but cannot move it
    Given the app runs unpackaged from a development build
    When the app opens the settings screen
    Then the launch-at-login switch cannot be moved
    And the row names the development build as the reason
