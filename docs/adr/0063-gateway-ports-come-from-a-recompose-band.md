# 0063: Gateway ports come from a recompose band, not the ephemeral pool

**Status**: Accepted
**Date**: 2026-07-31

## Context

Architecture Decision Record (ADR) 0056 gave every gateway its own loopback port, and it made the copied base URL the whole point of the feature. The first offer asked the operating system for a port by binding port 0.

Port 0 always draws from the ephemeral pool: 49152 to 65535 on macOS and Windows, 32768 to 60999 on Linux. That's the pool the kernel also draws from for outbound client sockets. So a port a gateway held yesterday can belong to another process's outbound connection today, and then the gateway won't start. The failure is random and reboot dependent, which is the worst shape for an address a person pasted somewhere else. The Linux kernel names the hazard itself, by offering a reserved-ports list for this case.

The offer also proved the wrong thing. It bound the IPv4 loopback alone, while a gateway binds both loopback families and treats a held IPv6 port as a failed start. A port held on the IPv6 loopback alone therefore passed the offer. recompose saved it, the start then failed, and the person read that another process held a port recompose had chosen a second earlier.

`GATEWAY_PORT_RANGE` already ran from 1024, so the schema always accepted a lower port than port-0 probing could reach.

## Decision

Gateway ports come from a band recompose owns: **8389 through 8436**, forty-eight ports, scanned in order and wrapping.

- **The user-data folder decides where an install enters the band**, through a hash folded into the band size. One install therefore keeps its ports across reboots and upgrades, and two installs on one machine start at different places instead of racing for the same port.
- **Binding the two loopback families a gateway binds is what proves a candidate**, under the rule the listener uses: the IPv4 bind must hold, and only a held IPv6 port refuses the port. An IPv6 loopback the machine can't offer at all still passes, so a host without IPv6 works.
- **The offer exhausts the band rather than escaping it.** When something holds all forty-eight, the offer fails and names the band. It never wanders into the ephemeral pool.
- **The stored document still wins.** The band decides a first offer only. An existing gateway starts on the port its own file carries, and the move-port recovery is what changes it.

The band starts above 8388, which Shadowsocks uses by default. It ends below 8442, whose registration this record couldn't confirm, and below 8443, which everything uses for alternate HTTPS. It sits far below every ephemeral floor, including the Linux floor of 32768.

`probe-free-port.ts` leaves the mutation-gate exclusion list. The band walk and the two-family rule are ordinary tested code now, and the file holds nothing but the socket calls around them. Two mutants of the two-family rule survive, and both are equivalent. The short-circuit and the branch behind it agree on every input, so no test can tell them apart.

This decision rides beside ADR-0056 and changes none of it.

## Alternatives

- **Keep asking for port 0.** One line, and nothing can fix it: no portable interface asks an operating system for a free port below the ephemeral pool. Binding port 0, reading the number, closing, and rebinding is a race in its own right.
- **One fixed port per install, first gateway to 8389 for everyone.** Simplest and the most documentable, and it makes every fresh install on a machine race for the same port. The end-to-end suite starts several app instances at once, each with its own user-data folder, so it would meet this first.
- **A registered band carrying no assignments at all.** The longest unassigned run near 8400 is fifteen ports, and 8400 through 8405 belong to Commvault. Forty-eight ports means overlapping registrations that no laptop listens on, which the registry's own text treats as advisory.
- **One shared port with path routing.** ADR-0056 already rejected it: a path-prefixed base URL breaks under the joining rule every client applies.

## Consequences

**Good**: a gateway address survives a reboot, so the copied base URL keeps answering. The offer proves the same two families the listener takes, so the offer and the start can no longer disagree. The scan steps over a port the operating system refuses for any reason, including a port Windows excludes and reports as a permission failure rather than a conflict.

**Bad**: the port is no longer predictable from this record alone, because the install folder decides where the band starts. Forty-eight gateways is now a ceiling. Two installs on one machine can still land on the same port by coincidence, one time in forty-eight. The end-to-end suite may meet that under parallel workers. The gap between proving a port free and a gateway taking it stays open, so a fast enough squatter still wins, and the failed start is what reports it.
