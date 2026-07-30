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

### Requirement: Controls that wait on machinery

The app MUST NOT offer a working control for a setting nothing reads. A setting whose machinery the repository lacks MUST render as unavailable and MUST name what it waits for. A reason MUST name a surface a person can picture rather than a subsystem, so it stays true as the machinery arrives. A setting the app has decided rather than deferred MUST state its value instead of rendering as an unavailable control. An inert control implies a choice that nobody will offer.

#### Scenario: a person meets a setting that waits on the canvas

- When a person reaches the reduced wire motion row
- Then the control renders as unavailable and names the canvas as what it waits for
- And the settings document holds no field for it

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
- Then the row states the loopback address as a value rather than offering a control
- And the row states that recompose never serves the network
