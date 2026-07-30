Feature: The gateway port

  Background:
    Given the app is on the settings screen
    And the stored port reads 8397

  Scenario: Leaving the field commits a new port
    When the maintainer types 9000 in the port field and moves focus away
    Then the stored port reads 9000

  Scenario: Enter commits a new port
    When the maintainer types 9000 in the port field and presses Enter
    Then the stored port reads 9000

  Scenario: Escape abandons an entry
    When the maintainer types 9000 in the port field and presses Escape
    Then the port field reads 8397
    And the stored port reads 8397

  Scenario: An uncommitted entry writes nothing
    When the maintainer types 9000 in the port field and stops there
    Then the stored port reads 8397

  Scenario Outline: A port outside the accepted range keeps the stored port
    When the maintainer commits <port> in the port field
    Then the stored port reads 8397
    And the field states that it accepts 1024 through 65535

    Examples:
      | port  |
      | 80    |
      | 1023  |
      | 65536 |

  Scenario: A non-numeric entry keeps the stored port
    When the maintainer commits "eight thousand" in the port field
    Then the stored port reads 8397
    And the field states that it accepts 1024 through 65535
