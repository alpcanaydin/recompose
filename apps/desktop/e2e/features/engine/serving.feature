Feature: What a running gateway answers

  Background:
    Given a running gateway named "codex"

  Scenario: The address works as a base URL without an added path
    When a client using the address of "codex" as its base URL sends a request
    Then "codex" answers the request

  Scenario: The health path answers for real
    When a client checks the health of "codex"
    Then a success answers carrying the name "codex"

  Scenario: A model request meets a typed refusal
    When a client sends a model request to "codex"
    Then a typed refusal answers
    And it names "codex" and states that it holds no model

  Scenario: Two running gateways keep to their own ports
    Given a running gateway named "gemini"
    When a client checks the health of "codex" and of "gemini"
    Then each answers with its own name
