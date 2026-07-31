# settings Specification

## Purpose

The behavioral contract of the settings a person can change from inside recompose. It covers what the screen presents, what a change reaches outside the window, and how a setting whose machinery the app lacks still names itself. Every setting the app stores belongs here, so nobody edits a document by hand to change one.

## Requirements

### Requirement: The settings shortcut

The app MUST answer the settings shortcut even when no window stands open, because the tray keeps the app alive after the last window closes. The shortcut MUST reach the settings surface inside the main window rather than opening a second window.

#### Scenario: a person presses the shortcut while the window stands open

- When a person presses the settings shortcut
- Then the settings surface takes over the content area
- And the sidebar selection moves to Settings
- And focus lands on the first control

#### Scenario: a person presses the shortcut with no window open

- When the tray shows, no window stands open, and a person presses the settings shortcut
- Then the app opens a window on the settings surface

### Requirement: Launch at login

On a platform that carries login items, the app MUST offer a launch-at-login switch backed by the operating system login item rather than by a stored flag alone. Where the platform carries none, the row MUST be absent rather than dimmed. A build that isn't packaged MUST render the row unavailable and name the development build as the reason. A login item registered from a development tree would point at the runner rather than at the app. The switch MUST report what the operating system holds, so a change made outside the app doesn't leave the screen lying.

#### Scenario: a development build offers the row it can't move

- When a person opens the settings screen from a build that isn't packaged
- Then the launch-at-login row renders unavailable and names the development build
- And the row stays reachable by keyboard

#### Scenario: a person turns launch at login on

- When a person turns the switch on
- Then the operating system lists recompose as a login item

#### Scenario: the operating system disagrees with the stored value

- When the settings screen opens and the login item doesn't match the stored flag
- Then the switch shows the operating system value

### Requirement: Menu bar presence

The app MUST offer a menu bar switch that adds or removes a tray icon while the app runs, without a restart. While the tray shows, closing the last window MUST leave the app running.

#### Scenario: a person turns the menu bar on

- When a person turns the switch on
- Then a tray icon appears without a restart

#### Scenario: the last window closes while the tray shows

- When a person closes the last window and the tray shows
- Then the app keeps running and the tray stays

### Requirement: A settings document from a newer build

The app MUST read the schema version a settings document names before parsing it. A version beyond what the build supports MUST become a typed failure rather than damage. The app MUST NOT move that document aside, and a save MUST refuse rather than write this build's shape over it. The screen names the version the document carries, so someone who ran a newer build and came back reads what happened instead of losing every setting.

#### Scenario: an older build meets a document from a newer one

- When the settings document names a schema version beyond what the build supports
- Then the settings screen reports the newer schema and names the version
- And the document stays untouched where it sits
- And a save refuses rather than overwriting it

#### Scenario: a settings document is genuinely damaged

- When the settings document names a supported version but fails its schema
- Then the app moves it aside and carries on with the defaults

### Requirement: Config folder access

The app MUST name the folder that holds its data and MUST open that folder in the operating system file browser on request. The action label MUST name the file browser the running platform ships, because a label naming another platform's browser misleads the reader.

#### Scenario: a person reveals the config folder

- When a person asks to reveal the folder
- Then the operating system file browser opens at that folder

#### Scenario: the label matches the platform

- When the settings screen renders the config folder row
- Then the action names the file browser the running platform ships

#### Scenario: the folder refuses to open

- When the operating system reports a failure opening the folder
- Then the row states that the folder didn't open

### Requirement: One settings screen, and the rows it refuses

The app MUST present every stored setting on a single screen inside the main window, grouped into General, Server, Appearance, and Data. A change MUST persist without a save action, because a preference that needs confirming reads as a form rather than a preference. The screen MUST NOT carry a port, because a port belongs to one gateway rather than to the app. The screen MUST NOT carry a token or a switch that demands one. A token guards one gateway's origin rather than the app, so replacing a leaked one belongs beside the gateway it guards.

#### Scenario: a person changes a setting

- When a person switches the theme to dark
- Then the app repaints in dark at once
- And the stored settings document holds the new theme after a restart

#### Scenario: a person looks for the gateway port

- When a person opens the settings screen
- Then the Server group offers no port
- And the stored settings document holds no port

#### Scenario: a person looks for the gateway token

- When a person opens the settings screen
- Then the Server group offers no token and no switch demanding one
- And the stored settings document holds no token requirement

#### Scenario: a person opens the group that lost a row

- When a person opens the Appearance group
- Then the group offers the theme and nothing beside it

### Requirement: Controls that wait, controls that decided, and controls that never arrive

The app MUST NOT offer a working control for a setting nothing reads. A setting whose machinery the repository lacks MUST render as unavailable and MUST name what it waits for. A reason MUST name a surface a person can picture rather than a subsystem, so it stays true as the machinery arrives. A setting the app has decided rather than deferred MUST state its value instead of rendering as an unavailable control. An inert control implies a choice that nobody will offer. A setting the project has decided never to build MUST be absent rather than waiting, because a row that names what will never arrive promises work nobody plans to do.

#### Scenario: a person meets a setting that waits on launch-time start

- When a person reaches the gateway autostart row
- Then the control renders as unavailable and names launch-time start as what it waits for
- And the settings document holds no field for it

#### Scenario: a person meets a setting that waits on request logging

- When a person reaches the log retention row
- Then the control renders as unavailable and names request logging as what it waits for
- And the settings document holds no field for it

#### Scenario: a person looks for the bind address

- When a person reaches the bind address row
- Then the row states both loopback addresses as a value rather than offering a control
- And the row states that recompose never serves the network
