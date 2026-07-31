# 0064: The window controls follow the sidebar

**Status**: Accepted
**Date**: 2026-07-31

## Context

The window hides its own title bar, so macOS draws the close, minimize, and zoom controls over whatever the renderer paints underneath. Until this change the window asked for `titleBarStyle: 'hiddenInset'`, which puts that cluster at an inset Electron picks. The renderer could only guess where it landed.

The guess held while the sidebar always stood. The controls sat over the sidebar's own top band and lined up with nothing else. This change gives the sidebar a control that puts it away. With the sidebar gone the cluster lands in the toolbar strip, beside a row of buttons that sit at the centre of 54 pixels. Nothing centres the cluster, so it reads 7 pixels high against every button next to it.

Electron's `trafficLightPosition` fixes that, and its documentation names a constraint. The option works with `titleBarStyle: 'hidden'`, and `hiddenInset` drops it.

Two bands want the cluster at two heights, and both are right. The sidebar's top band is 36 pixels, which is what the design reference draws. The toolbar strip is 54 pixels, which is what the reference fixes and close to the 52 points a macOS unified toolbar takes. No single position suits both.

## Decision

**The window asks for `hidden` rather than `hiddenInset`, and names the position itself.** `windowButtonsFor` is a pure function of one fact, whether the sidebar stands. It returns the point that centres a 12-pixel cluster in the band it will sit over: 12 while the sidebar stands, 21 once it leaves. The leading inset stays at 14 either way, so nothing shifts sideways as the sidebar moves.

**The position follows the sidebar as the person moves it.** The renderer owns whether the sidebar stands, so it reports the state over a new `system:sidebar-shown` channel, and main answers by calling `setWindowButtonPosition`. The root layout reports on mount as well as on every change, which covers a launch that restores a sidebar the person had put away.

**The toolbar strip carries the sidebar control, not the sidebar.** A control that leaves with the thing it hides strands anyone who hides it. Every surface draws that strip, whether a gateway stands selected or none does. It's the only place the control stays reachable. While the sidebar is away the strip takes a leading inset of 76 pixels. That clears the cluster and leaves the same 10-pixel gap the rest of the strip uses.

## Consequences

**Good**: the cluster sits at the centre of whatever row it joins, at a position this repository states rather than inherits. The sidebar control stays reachable from every surface, in both states. One pure function decides it, with its own spec, so a band that changes height changes one number.

**Bad**: a renderer concern now crosses the process boundary, which adds a channel to a roster this change already grew. The controls move as the sidebar toggles, which is motion nobody asked for. The alternative left them wrong in one state or the other. A window that hasn't opened yet drops the request, which costs nothing, because the constructor already carries the standing position.

## Alternatives

**Keep `hiddenInset` and reserve space around the guess.** Free, and it's what the branch did until the sidebar could close. It can't centre the cluster against anything, so the misalignment stays.

**Pick one position and make both bands agree.** Give the sidebar's top band the toolbar's 54 pixels and centre the cluster once. It costs the sidebar the heading position the reference draws, which is a visible regression traded for an alignment nobody sees while the sidebar stands.

**Collapse the sidebar to a narrow rail rather than hiding it.** Several applications do this, and the rail keeps the control without a second home. It leaves the cluster over the rail in both states, so the alignment question never arises. Rejected because the rail costs horizontal space on a surface whose canvas wants it, and because nothing in the reference draws one.
