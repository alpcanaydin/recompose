Feature: The gateway token

  Background:
    Given the app is on the settings screen

  Scenario: The token requirement ships off
    Then the token requirement reads off
    And no token stands on the screen

  Scenario: Turning the requirement on mints a token and shows it masked
    When the maintainer turns the token requirement on
    Then the token row shows a mask keeping the "rc-local-" prefix and the last four characters
    And the whole token never appears on the screen

  Scenario: Copying the token puts the whole value on the clipboard
    Given the token requirement is on
    When the maintainer copies the token
    Then the clipboard holds the stored token
    And the token row still shows only its mask

  Scenario: Regeneration states its consequence before it happens
    Given the token requirement is on
    When the maintainer asks for a new token
    Then the row states that clients holding the old token stop connecting
    And the cancelling choice holds focus
    And the stored token is unchanged

  Scenario: Escape abandons a regeneration
    Given the maintainer asked for a new token
    When the maintainer presses Escape
    Then the stored token is unchanged
    And the token row shows its mask again

  Scenario: Confirming a regeneration replaces the token
    Given the maintainer asked for a new token
    When the maintainer confirms the regeneration
    Then the stored token differs from the one before
    And the token row shows the mask of the new token

  Scenario: Turning the requirement off takes the token row off the screen
    Given the token requirement is on
    When the maintainer turns the requirement off
    Then no token stands on the screen

  Scenario: Turning the requirement back on shows the same token
    Given the maintainer turned the token requirement on and then off
    When the maintainer turns the requirement on again
    Then the token row shows the mask it showed before
    And the stored token is the one minted the first time

  Scenario: The settings document never carries the token
    Given the token requirement is on
    Then the stored settings document holds no token

  Scenario: A credential store the app cannot use blocks the token
    Given the operating system credential store is unavailable
    When the maintainer turns the token requirement on
    Then the requirement returns to off
    And the row states that the token cannot be stored without a credential store
    And no token is minted

  Scenario: A credential store that cannot encrypt warns before the first token
    Given the operating system credential store keeps secrets in plain text
    Then the token requirement reads off
    And no token stands on the screen
    And the token requirement row states that no system keyring is available and recompose stores the token in plain text

  Scenario: The plain text warning stays once a token exists
    Given the operating system credential store keeps secrets in plain text
    When the maintainer turns the token requirement on
    Then the token row shows its mask
    And the token requirement row still states that recompose stores the token in plain text

  Scenario: An encrypting credential store shows no plain text warning
    Given the operating system credential store encrypts secrets
    When the maintainer turns the token requirement on
    Then no plain text warning stands on the screen
