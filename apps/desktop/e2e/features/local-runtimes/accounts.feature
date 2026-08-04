Feature: The local runtime account row

  Background:
    Given the app is on the Local Runtimes screen

  Scenario: A stored runtime reads its name over its address
    Given a stored "Ollama" account whose server answers
    Then the row's first line reads "Ollama"
    And the row's second line reads "http://127.0.0.1:11434"
    And the standing reads "Running" with a mark beside the word

  Scenario: A server that stopped reads not running at the next look
    Given a stored "Ollama" account whose server has stopped
    When the surface lists it
    Then the standing reads "Not running" with a mark beside the word
    And the row's second line still reads "http://127.0.0.1:11434"

  Scenario: Another server on the port never reads as Ollama
    Given a stored "Ollama" account whose port another server answers
    When the surface lists it
    Then the standing reads "Another server answered" rather than "Running"
