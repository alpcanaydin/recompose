# subscriptions

## Purpose

The behavioral contract of a subscription account in recompose. It covers what connecting one does, what it never does, how the app lists one, what a row reports, and how a person adds another. A subscription is an account a person already pays a plan for, signed in through the provider's own tool. This contract states plainly that a gateway can't route to it.

## ADDED Requirements

### Requirement: A subscription is a managed account, never a gateway target

Connecting a subscription MUST record the account and MUST NOT make it reachable by a virtual model. The app MUST NOT hold a subscription credential for its own outbound use, and MUST NOT offer a provider sign-in as a way to feed a gateway. The surface MUST state what a subscription is good for before a person connects one, rather than letting the first request teach the limit.

#### Scenario: a person reads what a subscription account serves

- When the subscriptions surface lists a connected account
- Then the row states that the account serves the provider's own tool
- And no part of the surface offers the account as a gateway target

#### Scenario: a gateway never lists a subscription among its targets

- Given a connected subscription account
- When a person composes a virtual model
- Then the subscription account appears nowhere among the targets offered

### Requirement: The provider's own tool performs the sign-in

The app MUST delegate signing in and renewing authorization to the provider's own command-line tool rather than running an authorization flow of its own. The app MUST NOT store a refresh token it renews itself.

#### Scenario: a person connects a subscription

- When a person chooses to sign in for a provider that offers it
- Then the app hands the sign-in to that provider's own tool
- And the account appears once that tool reports success

#### Scenario: the provider's tool is absent

- Given the provider's command-line tool isn't installed
- When a person chooses to sign in for that provider
- Then the surface names the missing tool and what to do about it
- And no sign-in begins

### Requirement: The empty state says what a subscription is

With no subscription connected, the surface MUST present a single call to action alongside a sentence naming what a subscription account is, rather than an empty list.

#### Scenario: a person opens the surface with nothing connected

- When the subscriptions surface loads and no subscription exists
- Then the surface shows the call to action and its explanation
- And no account list renders

### Requirement: A row reports the account and where it stands

A row MUST carry the provider's mark, the provider's name, the plan the account holds, the account it signs in as, and its standing. Standing MUST read as a word with a mark beside it rather than as color alone.

#### Scenario: a connected account reads as connected

- When the surface lists an account whose authorization holds
- Then the row reports it as connected
- And the report carries a mark beside the word

### Requirement: A lapsed account carries its own way back

An account whose authorization lapsed MUST report that on its own row and MUST offer the way to restore it on that row. The app MUST NOT report a lapse only as a banner over the list, and MUST NOT leave a lapsed account looking connected.

#### Scenario: an account loses its authorization

- Given a connected account whose authorization lapsed
- When the subscriptions surface lists it
- Then the row reports the lapse rather than reporting it as connected
- And the row offers the way to restore the account

### Requirement: Adding a provider opens the catalog

The way to another subscription MUST open a catalog carrying every provider the app can connect, grouped by kind, each entry naming the provider and what connecting it gives. The catalog MUST offer a search field and a way to narrow to one kind.

#### Scenario: a person opens the catalog

- When a person asks to add a provider
- Then the catalog opens beside the surface rather than replacing it
- And it lists the providers grouped by kind

#### Scenario: a person narrows the catalog to one kind

- Given the catalog stands open
- When a person narrows it to subscriptions
- Then only the subscription providers remain listed

### Requirement: Picking a provider states what each way of connecting yields

A provider offering more than one way to connect MUST present them together, and each MUST state what it yields rather than how many steps it takes. A sign-in MUST say it yields an account for the provider's own tool. A key MUST say it yields a target a gateway can reach.

#### Scenario: a person picks a provider offering both ways

- When a person picks a provider that accepts a sign-in and a key
- Then both ways stand together
- And each names what connecting that way gives them
