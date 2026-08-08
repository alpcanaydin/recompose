Feature: Every stored account stands as a target

  The target picker offers the subscription, key, aggregator, and local kinds
  alike, and a stored definition naming any of them stands bound, so whether a
  target can answer is decided per request rather than at write time.

  Scenario: The picker offers every stored kind
    Given a gateway and a stored subscription, key, aggregator, and local account
    When the person opens the target picker for a new virtual model
    Then the picker lists the subscription, the key, the aggregator, and the local account

  Scenario: A stored subscription target stands bound
    Given a stored virtual model "fast" whose target names a subscription account
    When the gateway config loads
    Then the drawer reads "fast" over the subscription account
