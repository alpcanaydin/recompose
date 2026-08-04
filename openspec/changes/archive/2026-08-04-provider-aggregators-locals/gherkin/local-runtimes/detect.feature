Feature: Detection before adding a local runtime

  Background:
    Given the app is on the Local Runtimes screen

  Scenario: Picking Ollama looks at once and reports the running server
    Given Ollama version "0.5.1" answers on its documented localhost port
    When the maintainer picks "Ollama" in the catalog
    Then the surface reads "Ollama is running at 127.0.0.1:11434."
    And the version "0.5.1" stands beneath
    And no act asked permission to look

  Scenario: Silence stores nothing until the maintainer decides
    Given nothing answers on the documented port
    When the maintainer picks "Ollama" in the catalog
    Then the surface reads "Ollama isn't running at 127.0.0.1:11434. Start it, then check again."
    And "Check again" leads, with "Add anyway" standing beside it as a plain act
    And no account joins the registry

  @probes-the-minted-address
  Scenario: a runtime on a moved port answers through the port field
    Given Ollama answers on a port that isn't the documented one
    When the maintainer picks "Ollama" and points the look at that port
    Then the surface reads that Ollama is running at that port
    And adding it stores that address with no credential
