Feature: The config folder

  Background:
    Given the app is on the settings screen

  Scenario: The row names the folder before opening it
    Then the config folder row shows the folder that holds the settings document

  Scenario: Revealing the folder opens it in the file browser
    When the maintainer reveals the config folder
    Then the operating system opens the folder that holds recompose data

  Scenario Outline: The reveal action names the file browser the platform ships
    Given the app runs on <platform>
    Then the config folder row offers "<label>"

    Examples:
      | platform | label            |
      | macOS    | Reveal in Finder |
      | Windows  | Show in Explorer |
      | Linux    | Open folder      |

  Scenario: A folder that refuses to open says so
    Given the operating system refuses to open the config folder
    When the maintainer reveals the config folder
    Then the row states that the folder did not open
