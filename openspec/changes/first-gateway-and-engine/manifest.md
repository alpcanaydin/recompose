---
tier: full
phase: implementation
approvals:
  - the full tier over no override, because the gateway contract, a new engine subsystem, the process boundary, and three renderer slices all change together
  - the gateway config schema stays at version 1 with no migration, and backward compatibility constrains nothing anywhere in this change, because recompose has no release and no stored document
  - the scope adds the toolbar address pill with its copy affordance and the get-started checklist to the requested set, and leaves the canvas gateway node out
  - a failed start reaches the screen as a binary stopped dot beside a separate error line naming the port that was taken
  - the engine serves over Hono and the node-server adapter rather than Node's http, bought for the port-free behavior specs the testing rules ask for, which revisits the line ADR-0002 drew
  - a failed start travels inside the engine state union rather than as an error code, so the invoke response, the push payload, and the error line read one representation
  - the contracts cluster lands alone first and opens with the two spikes, the dependency-cruiser verdict on the modulePath import and the node-server adapter under the utility process, rather than meeting either at integration
  - the story suite gains a second scheme in this change, a dark vitest project beside the light one and an assertion that the requested scheme actually applied, because the components this change adds include one whose only job is to carry a state color
  - the engine child stays resident across start and stop, and the address copy runs in the renderer, because the address carries no secret and the vault precedent turns on secrecy
  - each gateway owns its own loopback port and answers at the root of its own address, which supersedes ADR-0005, because a shared port left per-gateway start and stop at routing level and left the per-gateway status dot mirroring one engine state
  - the slug reservation for v1 and health drops with the shared port, because nothing routes by path any longer, while the length bound and the Windows device-name refusal stay, because the slug is still a filename
  - the settings screen loses the port outright, which carries a modified delta against the settings capability and retires a shipped row, its browser test, an accepted scenario, and a compiled acceptance feature
  - the creation sheet takes a port after all, arriving filled with a free one, so a person with no opinion never picks a port and a person with one never fights the app
  - a new gateway serves the moment it saves, and one that loses its port between the offer and the save stores anyway and shows as stopped beside its failure
  - the menu bar lists every gateway, each carrying a submenu of start, stop, and restart with icons, and an entry a gateway's state rules out renders unavailable rather than disappearing, so the submenu keeps one shape
  - a gateway settings surface becomes a separate feature, so this change offers no way to edit a name, a slug, or a port after creation
  - a failed start offers to move the gateway to a free port, which the separate gateway settings feature makes load-bearing rather than optional, because it's the only recovery this change ships for a squatted port
  - gate 1 approved the design document with the design critique folded in, covering the toolbar drag region that would have eaten every click, the running-state token that measured level with the stopped one, the sidebar compositing over the desktop rather than a token, and the shape carrier that replaced a repeated state word
  - the settings schema moves to version 3 through a migration that drops the port, reversing a gate-1 simplification that rested on a check run against the wrong path; a stored version 2 document carrying the field sits under the @recompose/desktop user-data directory, and the schema is strict, so a version-free removal would read that document as damage
  - the gateway document takes a required port field at version 1 with no migration, confirmed rather than assumed, because the stored gateways directory holds no document to quarantine
  - the address copy stays in the renderer and the permission policy opens exactly one allow for it, which amends the deny-everything baseline ADR-0028 set and earns a fifth ADR, because a baseline that grows its first exception is a decision rather than a detail
  - gate 2 approved the scenario set, which freezes here, and the solution design with its six task clusters, its five-layer test matrix, and its five ADR drafts
  - the channel roster reaches seventeen rather than fifteen, because a snapshot read keeps first paint from racing the first push, and the move-to-a-free-port recovery needs its own channel now that saving carries creation-only semantics
  - the first replan moved the five engine channels from the contracts cluster to the main-process cluster, because IpcHandlers is a total mapped type and three of the five need the engine host, so landing them earlier would have forced either a lying handler body or a Partial that trades away the totality ADR-0018 bought
  - the frozen scenario set took its first amendment: the state mark reads as a filled dot in two colors, green for running and red for stopped, so the gateways delta drops the rule that the report may not rest on color alone
  - the amendment carries a known cost the maintainer accepted, that green and red are the pair a reader with deuteranopia or protanopia can't separate, and the mark's accessible name is what still carries the state
  - the primary button fills with a new single-value accent token rather than the accent itself, because a white label on the accent measured 4.01 to 1 and axe refused it, which departs from the light-dark pairing ADR-0009 asks for and follows the surface-thumb precedent instead
branch: worktree-first-gateway-and-engine
---
