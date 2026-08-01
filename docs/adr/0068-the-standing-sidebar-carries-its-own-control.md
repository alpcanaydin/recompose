# 0068: The standing sidebar carries the control that puts it away

**Status**: Accepted
**Date**: 2026-08-01

## Context

A surface holding no gateway draws no toolbar. It draws a drag region instead, because the hidden title bar leaves the renderer to supply one, and that region carried the control that puts the sidebar away. On such a surface the region held nothing else, so the control stood alone in an otherwise empty band. The maintainer read it as orphaned, and it was.

The obvious repair is to stop drawing it there. Architecture Decision Record (ADR) 0064 rules that out on its own terms. The control is the only way back once the sidebar has gone. A person who put it away on a surface carrying no gateway would have nothing left to press, and on a fresh install nothing would ever close the sidebar again.

Mobbin says nobody draws a band that holds only this control. Wrangle and Fibery put the collapse control in the sidebar's own header. Mixpanel puts it at the sidebar's foot. Braintrust and Cloudflare keep it in the top strip, but beside the name of the surface, never alone. The reference this project draws from agrees by omission: on the providers template the surface names itself inside the scroll area, so the strip has nothing to say.

## Decision

**One control puts the sidebar away, and it stands wherever the chrome at the top leading corner is.**

The standing sidebar carries it in its own top band, at the trailing edge. That band already exists. It's the inset that clears the window controls, 36px tall, and macOS centres its own controls in it. The control takes that same centre, 18px down, and sits far enough along that nothing collides with the corner the controls occupy. A story measures both rather than trusting the eye.

**A surface that has a toolbar keeps the control there.** A gateway surface always draws one, so the control leads that strip and the sidebar's band stays empty. A surface with no gateway draws a bar only once the sidebar has gone, so its band carries the control until then. Exactly one control is ever within reach. The shell decides which by handing the sidebar what its band holds, rather than by telling it which route is open.

**The drag region stays whatever the control does.** It's the only thing that lets a person take hold of the window from the top of the content area. Every surface holding no gateway draws it, and once the sidebar is away it takes the toolbar's surface and hairline and carries the control. It stays out of the flow either way, over the inset every page already leaves at its top. So nothing shifts, and scrolled content passes under a bar rather than under a floating control.

**The edge is a control too.** Dragging the sidebar's trailing edge towards the sidebar puts it away, and dragging out from it brings it back. Each waits until the pointer has travelled far enough to mean it rather than to have grazed the edge. The edge travels with the sidebar, so once the sidebar has gone it waits at the window's leading edge. It answers the arrow keys as well, and reports the width it stands at. A `separator` a person can focus is a range widget, and a control only a pointer can reach is no control at all for anyone who doesn't use one.

**The sidebar leaves and returns over 220ms rather than blinking.** It stays mounted and its slot animates its width, so nothing unmounts and nothing reflows in one frame. While it's away the slot is inert. That takes everything inside it out of the accessibility tree and out of the focus order, rather than leaving a hidden thing a keyboard could still reach. Anyone who asked for less motion gets the change at once.

## Consequences

**Good**: no surface draws the control twice, and no surface draws a band whose only occupant is a control. The control now sits in the band the window controls share, on their centre, which reads as one row rather than two ideas. Nothing traps a person with the sidebar away, because the toolbar picks the control up exactly when the sidebar drops it.

**Bad**: the control changes place as a person moves between a gateway and a surface without one, even though the sidebar never moved. That's the price of putting it wherever the top bar is, and it's visible whenever somebody navigates with the sidebar standing.

**Bad**: nothing can animate the native window controls. `setWindowButtonPosition` moves them in one step, so while the sidebar's width animates they jump the 9px between the band's centre and the toolbar's. Making both bands the same height would remove the jump and push the sidebar's first heading 18px down, which is a larger change than the jump is worth today.

## Alternatives

**Draw the control only in the toolbar, as before.** It's where the reference puts it, and it leaves the group at three. It's also what made the empty band, and the band is what the maintainer objected to.

**Draw nothing on a surface holding no gateway.** The simplest change and a dead end. It strands a person who has put the sidebar away, which ADR-0064 already refused, and on a fresh install it takes the act away entirely.

**Name the surface in the strip and keep the control beside it.** Cloudflare and Braintrust do this, and it gives the band something to say. Every surface here already carries its own heading inside the scroll area, so the strip would repeat what the content states one line below it.
