Feature: Controls that wait on machinery

  Background:
    Given the app is on the settings screen

  Scenario Outline: A row that waits on the engine names the engine
    Then the "<row>" control cannot be moved
    And the row names the engine as what it waits for
    And the stored settings document holds no field for it

    Examples:
      | row                      |
      | Bind address             |
      | Start gateways on launch |
      | Keep request logs        |

  Scenario: The reduced wire motion row names the canvas
    Then the "Reduce wire motion" control cannot be moved
    And the row names the canvas as what it waits for
    And the stored settings document holds no field for it

  Scenario: A waiting row stays reachable from the keyboard
    When the maintainer tabs through the settings screen
    Then every waiting row takes focus in turn
    And each one states what it waits for while focused

  Scenario: A waiting row refuses a change
    When the maintainer tries to change the bind address
    Then the control stays where it was
    And the stored settings document is unchanged
