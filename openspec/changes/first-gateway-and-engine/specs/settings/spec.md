# settings

## MODIFIED Requirements

### Requirement: One settings screen

The app MUST present every stored setting on a single screen inside the main window, grouped into General, Server, Appearance, and Data. A change MUST persist without a save action, because a preference that needs confirming reads as a form rather than a preference. The screen MUST NOT carry a port, because a port belongs to one gateway rather than to the app.

#### Scenario: a person changes a setting

- When a person switches the theme to dark
- Then the app repaints in dark at once
- And the stored settings document holds the new theme after a restart

#### Scenario: a person looks for the gateway port

- When a person opens the settings screen
- Then the Server group offers no port
- And the stored settings document holds no port
