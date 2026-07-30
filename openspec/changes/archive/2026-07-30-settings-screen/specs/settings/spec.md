# settings

## Purpose

The behavioral contract of app-wide settings in recompose: which preferences the app holds, how a person changes them, and what the app refuses to offer.

## ADDED Requirements

### Requirement: One settings screen

The app MUST present every stored setting on a single screen inside the main window, grouped into General, Server, Appearance, and Data. A change MUST persist without a save action, because a preference that needs confirming reads as a form rather than a preference.

#### Scenario: a person changes a setting

- When a person switches the theme to dark
- Then the app repaints in dark at once
- And the stored settings document holds the new theme after a restart

#### Scenario: a person enters a port outside the allowed range

- When a person types a port below 1024 or above 65535
- Then the app keeps the stored port
- And the field states the range it accepts

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

On a platform that carries login items, the app MUST offer a launch-at-login switch backed by the operating system login item rather than by a stored flag alone. Where the platform carries none, the row MUST be absent rather than dimmed. The switch MUST report what the operating system holds, so a change made outside the app doesn't leave the screen lying.

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

### Requirement: Gateway token

The app MUST hold the gateway token in the vault rather than in the settings document, because the settings document sits on disk in plain text. The screen MUST show a masked token, copy the full value on request, and mint a replacement on request. Turning the token requirement off MUST NOT destroy the stored token.

#### Scenario: a person turns the token requirement on for the first time

- When a person turns the requirement on and no token exists
- Then the app mints a token, stores it in the vault, and shows it masked

#### Scenario: a person regenerates the token

- When a person asks for a new token
- Then the app replaces the stored token and shows the new value masked

#### Scenario: a person turns the token requirement off

- When a person turns the requirement off
- Then the stored token survives
- And turning the requirement on again shows the same token

#### Scenario: the settings document never carries the token

- When the app writes the settings document
- Then the document holds no token

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

### Requirement: Controls that wait on machinery

The app MUST NOT offer a working control for a setting nothing reads. A setting whose machinery the repository lacks MUST render as unavailable and MUST name what it waits for.

#### Scenario: a person meets a setting that waits on the engine

- When a person reaches the bind address, gateway autostart, or log retention row
- Then the control renders as unavailable and names the engine as what it waits for
- And the settings document holds no field for it

#### Scenario: a person meets a setting that waits on the canvas

- When a person reaches the reduced wire motion row
- Then the control renders as unavailable and names the canvas as what it waits for
- And the settings document holds no field for it
