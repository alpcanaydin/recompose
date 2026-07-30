Feature: Controls that wait on machinery

  Background:
    Given the app is on the settings screen

  Scenario: The log retention row names the engine
    Then the "Keep request logs" control cannot be moved
    And the row names the engine as what it waits for
    And the stored settings document holds no field for it

  Scenario: The autostart row names launch-time start
    Then the "Start gateways on launch" control cannot be moved
    And the row names launch-time start as what it waits for
    And the stored settings document holds no field for it

  Scenario: The reduced wire motion row names the canvas
    Then the "Reduce wire motion" control cannot be moved
    And the row names the canvas as what it waits for
    And the stored settings document holds no field for it

  Scenario: The bind address states its value rather than offering a control
    Then the bind address row reads "127.0.0.1"
    And the row states that recompose never serves the network

  Scenario: A waiting row stays reachable from the keyboard
    When the maintainer tabs through the settings screen
    Then every waiting row takes focus in turn
    And each one states what it waits for while focused

  Scenario: A waiting row refuses a change
    When the maintainer tries to start gateways on launch
    Then the control stays where it was
    And the stored settings document is unchanged
