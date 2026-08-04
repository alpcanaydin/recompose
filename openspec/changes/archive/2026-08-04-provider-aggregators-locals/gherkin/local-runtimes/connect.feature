Feature: Adding a local runtime

  Background:
    Given the app is on the Local Runtimes screen

  Scenario: Adding a running runtime stores an account with no credential
    Given Ollama answers on its documented localhost port
    When the maintainer adds "Ollama" from the catalog
    Then the account lists under the Local Runtimes surface
    And the vault holds nothing for the account

  Scenario: A decision to add is honored even on silence
    Given nothing answers on the documented port
    When the maintainer adds "Ollama" anyway
    Then the account lists under the Local Runtimes surface
