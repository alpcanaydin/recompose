Feature: The recompose mark on every artifact

  Scenario: The Windows executable carries the mark
    Given the packaged Windows build
    Then the executable carries the recompose mark as its icon
    And the icon steps through 16, 24, 32, 48, and 256 pixels
    And the 16 and 24 pixel entries drop the tile and show the note alone

  Scenario: The Linux launcher gets the full ladder
    Given the packaged Linux build
    Then the installed icon theme carries the mark at 16, 24, 32, 48, 64, 96, 128, 256, and 512 pixels
    And the 16 and 24 pixel rungs drop the tile and show the note alone

  Scenario: The AppImage carries its own icon
    Given the packaged AppImage
    Then the image carries the recompose mark as its directory icon

  Scenario: The desktop entry ties the launcher to the running app
    Given the packaged Linux build
    Then the desktop entry names the icon recompose
    And the desktop links running windows to the entry

  Scenario: The window frame wears the mark on Linux
    Given the app runs on Linux
    When the app opens its window
    Then the window frame shows the recompose mark

  Scenario: The stock Electron artwork ships nowhere
    Given the packaged build
    Then no icon the artifact ships matches the stock Electron artwork
