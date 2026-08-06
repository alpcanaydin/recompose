Feature: A subscription account never stands as a target

  The target picker offers the key, aggregator, and local kinds. A subscription
  account stands nowhere in it, and the stored definition refuses one at parse,
  so the prohibition holds as a contract rather than a screen habit.

  Scenario: The picker offers three kinds and no subscription
    Given a gateway and a stored subscription, key, aggregator, and local account
    When the person opens the target picker for a new virtual model
    Then the picker lists the key, the aggregator, and the local account
    And no subscription account stands anywhere in it

  Scenario: A stored definition refuses a subscription target at parse
    Given a stored virtual model "fast" whose target names a subscription account
    When the gateway config loads
    Then the config refuses the definition
    And names the subscription target as the reason
