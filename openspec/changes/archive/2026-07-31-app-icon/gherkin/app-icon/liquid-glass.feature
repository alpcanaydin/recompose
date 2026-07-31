Feature: Liquid Glass on macOS

  Scenario: macOS 26 renders the icon from the asset catalog
    Given the packaged macOS bundle
    Then the bundle carries a native icon asset catalog
    And the bundle names the catalog as its icon

  Scenario: macOS 15 keeps the legacy bitmap icon
    Given the packaged macOS bundle
    Then the bundle carries a legacy bitmap icon
    And the bundle names the bitmap as its fallback icon
