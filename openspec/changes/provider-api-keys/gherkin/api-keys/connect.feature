Feature: Connecting a key

  Background:
    Given the app is on the API Keys screen

  Scenario: A picked entry asks for a name and a key
    When the maintainer picks "Anthropic API" in the catalog
    Then the form asks for a name and a key
    And no field asks for a provider, a base URL, or a dialect
    And the surface names "api.anthropic.com" as the host the key reaches

  Scenario: A name stands once per provider
    Given a connected "Anthropic API" key named "build"
    When the maintainer connects another "Anthropic API" key named "build"
    Then the connect is refused, naming the holder of "build"
    And the vault holds nothing for the refused key

  Scenario: Two providers may share a name
    Given a connected "Anthropic API" key named "build"
    When the maintainer connects an "OpenAI API" key named "build"
    Then two rows named "build" stand, one under "Anthropic API" and one under "OpenAI API"

  Scenario: A key pasted with a trailing newline connects trimmed
    When the maintainer connects an "Anthropic API" key ending in "7f2c" followed by a newline
    Then the account connects
    And the masked tail reads "7f2c"

  Scenario: A key holding a control character is refused for its contents
    When the maintainer connects an "Anthropic API" key holding a control character inside it
    Then the connect is refused
    And the refusal speaks of the key's contents, never of its shape

  Scenario: A key shaped like another vendor warns and still connects
    When the maintainer connects a key beginning "sk-ant-" under the "OpenAI API" entry
    Then a warning says the key's shape suggests another vendor
    And the account connects
