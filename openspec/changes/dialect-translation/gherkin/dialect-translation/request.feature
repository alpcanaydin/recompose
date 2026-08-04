Feature: A request crosses the dialects whole

  Scenario: A tool-calling request crosses to the other dialect with its tools, choice, and system intact
    Given an Anthropic request carrying a system prompt, tool definitions, and a tool choice
    When the library translates it for an OpenAI target
    Then the tools, the choice, and the system prompt stand in the OpenAI shape
    And nothing the source carried has vanished without a named fate

  Scenario: A bare object tool schema normalizes to an explicit empty properties object
    Given a tool whose input schema is a bare object type with no properties
    When the library translates the request for an OpenAI target
    Then the schema carries an explicit empty properties object

  Scenario: System and developer messages collapse to one leading system prompt
    Given an OpenAI request whose system message reads "Be concise" and whose developer message reads "Answer in English"
    When the library translates it for an Anthropic target
    Then a single system prompt leads the request
    And it reads "Be concise" then "Answer in English" joined by a single newline

  Scenario: A request missing a token ceiling reaches an Anthropic target with a documented default
    Given an OpenAI request that names no token ceiling
    When the library translates it for an Anthropic target
    Then the request reaches the target carrying a token ceiling
    And that ceiling is a documented value the consumer can see, not a hidden constant

  Scenario: A temperature above the Anthropic ceiling clamps to one
    Given an OpenAI request whose temperature reads 1.7
    When the library translates it for an Anthropic target
    Then the temperature stands at 1, the Anthropic ceiling

  Scenario: A Codex request crosses to an Anthropic target with its instructions, tools, and input intact
    Given a Responses-dialect request carrying instructions, tool definitions, and input
    When the library translates it for an Anthropic target
    Then the instructions, the tools, and the input stand in the Anthropic shape
    And nothing the source carried has vanished without a named fate

  Scenario: A thinking block drops toward OpenAI with a traced, cost-bearing fate
    Given an Anthropic request whose history carries a thinking block
    When the library translates it for an OpenAI target
    Then the thinking block leaves the request
    And the translation records the drop as a cost-bearing fate
