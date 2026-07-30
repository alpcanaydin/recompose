Feature: The creation sheet

  Background:
    Given the app is on the gateways screen

  Scenario: The port arrives filled with a free port
    When the maintainer opens the creation sheet
    Then the port field already holds a free port
    And the preview carries that port

  Scenario: The preview follows the port field
    Given the creation sheet is open
    When the maintainer replaces the port with 9000
    Then the sheet previews serving at "http://localhost:9000"

  Scenario Outline: A slug the format refuses keeps the sheet open
    Given the creation sheet is open
    When the maintainer tries the slug "<slug>"
    Then the sheet stays open
    And the slug field reads "Accepts lowercase letters, digits, and single dashes."

    Examples:
      | slug   |
      | Codex  |
      | codex- |

  Scenario: A slug Windows reserves keeps the sheet open
    Given the creation sheet is open
    When the maintainer tries the slug "con"
    Then the sheet stays open
    And the slug field reads "Windows reserves this name."

  Scenario: A slug another gateway holds keeps the sheet open
    Given a gateway named "codex" exists
    And the creation sheet is open
    When the maintainer tries the slug "codex"
    Then the sheet stays open
    And the slug field reads "Another gateway holds this slug."

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
