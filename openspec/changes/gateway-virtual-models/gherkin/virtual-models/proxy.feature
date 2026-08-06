Feature: The gateway proxies the virtual name to its target

  A request arriving under a defined name forwards to the target account's
  provider under the real model name, carrying the account's credential. An
  undefined name, a removed target, or a missing credential answers a typed
  refusal that names what's missing, and the gateway never falls back.

  Scenario: A request under the virtual name reaches the target
    Given a gateway holding a virtual model bound to a stored key account
    When a request arrives under the virtual model's name
    Then the target's provider receives it under the target's real model name
    And the answer travels back to the caller

  Scenario: An undefined name refuses with its reason
    Given a gateway holding no virtual model under the name "ghost"
    When a request arrives under "ghost"
    Then the gateway answers a typed refusal naming the unknown model
    And no request leaves the machine

  Scenario: A removed target refuses instead of falling back
    Given a virtual model whose target account left the registry
    When a request arrives under its name
    Then the gateway answers a typed refusal naming the missing target
    And nothing else receives the request

  Scenario: A missing credential refuses instead of falling back
    Given a virtual model whose target account holds no stored credential
    When a request arrives under its name
    Then the gateway answers a typed refusal naming the missing credential
    And nothing else receives the request

  Scenario: The listing names every defined model on both dialects
    Given a gateway holding two virtual models
    When a client asks the gateway for its model listing
    Then the listing names both virtual models
    And it answers the same set in the Anthropic and the OpenAI shape
