# subscriptions

## Purpose

The behavioral contract of a subscription account in recompose. It covers what connecting one does, what it never does, how the app lists one, what a row reports, and how a person adds another. A subscription is an account a person already pays a plan for, signed in through the provider's own tool. This contract states plainly that a gateway can't route to it.

## Requirements

### Requirement: A subscription is a managed account, never a gateway target

Connecting a subscription MUST record the account and MUST NOT make it reachable by a virtual model. The app MUST NOT hold a subscription credential for its own outbound use, and MUST NOT offer a provider sign-in as a way to feed a gateway. The surface MUST state what a subscription is good for before a person connects one, rather than letting the first request teach the limit.

#### Scenario: a person reads what a subscription account serves

- When the subscriptions surface lists a connected account
- Then the row names the plan product the account signs into
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

### Requirement: One address stands as one account

A sign-in that lands an address the app already holds for that provider MUST write over that account rather than record a second one. The check runs on return, because the tool only names the address once the sign-in finishes. A sign-in that names nobody MUST stand as its own account.

#### Scenario: a person signs the same address in again

- Given a connected account signed in as an address
- When a sign-in for the same provider lands the same address
- Then the surface lists one account for that address
- And the account stands connected and active

### Requirement: The empty state says what a subscription is

With no subscription connected, the surface MUST present a single call to action alongside a sentence naming what a subscription account is, rather than an empty list.

#### Scenario: a person opens the surface with nothing connected

- When the subscriptions surface loads and no subscription exists
- Then the surface shows the call to action and its explanation
- And no account list renders

### Requirement: A row reports the account and where it stands

A row MUST carry the provider's mark, the plan product's name, the plan the account holds, the address it signs in as, and its standing. The identity MUST hold two lines, the product with its plan and the address, and nothing more. Standing MUST read as a word with a mark beside it rather than as color alone.

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

The way to another account MUST stand once, at the trailing edge of the window strip. It MUST open a catalog over the surface, holding only the kind that surface holds. Each entry MUST name the plan product and what connecting it gives. A provider the release can't connect yet MUST stand inert rather than hidden.

#### Scenario: a person opens the catalog from the subscriptions surface

- When a person asks to add a provider
- Then the catalog opens over the surface, holding only subscription plans
- And the plans that can't connect yet stand inert

### Requirement: Picking a provider offers the one way the surface holds

The surface opens the catalog for one kind, so a picked provider MUST offer only that kind's way of connecting. A subscription pick MUST hand the sign-in to the provider's own tool and MUST NOT offer a key beside it. A key pick MUST ask for a name and a key, because the provider rides in from the picked entry.

#### Scenario: a person picks a provider from the subscriptions catalog

- When a person picks "anthropic" in the catalog the subscriptions surface opened
- Then the sign-in stands alone, yielding an account for the provider's own tool
- And the surface asks for no key
