Feature: The note glyph in the tray

  Scenario: The menu bar extra on macOS shows the note alone
    Given the app runs on macOS
    When the app adds its menu bar extra
    Then the menu bar shows the note glyph without the tile or the frame
    And the glyph is a template image the system tints

  Scenario Outline: The notification area shows the cream note outside macOS
    Given the app runs on <platform>
    When the app adds its notification area icon
    Then the notification area shows the cream note with its dark contour

    Examples:
      | platform |
      | Windows  |
      | Linux    |
