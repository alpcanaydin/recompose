Feature: The creation sheet

  Background:
    Given the app is on the gateways screen

  Scenario: The sheet asks for a name and a port, and never for a slug
    When the maintainer opens the creation sheet
    Then the sheet asks for a name and a port only

  Scenario: The port arrives filled with a free port
    When the maintainer opens the creation sheet
    Then the port field already holds a free port
    And the preview carries that port

  Scenario: The preview follows the port field
    Given the creation sheet is open
    When the maintainer replaces the port with 9000
    Then the sheet previews serving at "http://localhost:9000"

  Scenario: A name Windows keeps for a device keeps the sheet open
    Given the creation sheet is open
    When the maintainer tries the name "Con"
    Then the sheet stays open
    And the name field reads "Windows reserves this name."

  Scenario: A name another gateway holds keeps the sheet open
    Given a gateway named "codex" exists
    And the creation sheet is open
    When the maintainer tries the name "codex"
    Then the sheet stays open
    And the name field reads "Another gateway holds this name."

  Scenario Outline: A port outside the accepted range keeps the sheet open
    Given the creation sheet is open
    When the maintainer tries the port <port>
    Then the sheet stays open
    And the port field reads "Accepts 1024 through 65535."

    Examples:
      | port  |
      | 80    |
      | 1023  |
      | 65536 |

  Scenario: A port another gateway holds keeps the sheet open
    Given a gateway named "codex" exists
    And the creation sheet is open
    When the maintainer tries the port that "codex" holds
    Then the sheet stays open
    And the port field reads "codex already holds this port."
    And "codex" keeps its port
