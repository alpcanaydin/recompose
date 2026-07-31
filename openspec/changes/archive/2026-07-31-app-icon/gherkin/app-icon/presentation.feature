Feature: The Recompose presentation

  Scenario: The bundle presents itself as Recompose
    Given the packaged macOS bundle
    Then the bundle names itself Recompose

  Scenario: The desktop entry displays the product name
    Given the packaged Linux build
    Then the desktop entry displays Recompose

  Scenario: The application menu names the app
    Given the app runs on macOS
    Then the application menu labels the app Recompose

  Scenario: The tray tooltip names the app
    When the app adds its menu bar extra
    Then the tray tooltip reads Recompose

  Scenario: The tray menu reads as prose
    When the app adds its menu bar extra
    Then the tray menu offers "Open recompose" and "Quit recompose"
