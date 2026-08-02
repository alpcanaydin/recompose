# 0069: Subscriptions delegate to the provider's tool, and custody follows each platform's limit

**Status**: Accepted
**Date**: 2026-08-02

## Context

A person who pays for a Claude or a ChatGPT plan wants recompose to route through that plan. The obvious build is the wrong one. Anthropic forbids a third party to offer a claude.ai login, or to send plan credentials at its interface. It enforces the rule on the wire, by checking which client calls. A gateway that spent a subscription credential would fail that check, and it would deserve to.

The account switchers that sit beside Claude Code stay permitted, and the reason is precise. They never make an inference request. They hold more than one signed-in account, they change which one is current, and the vendor's own tool makes every call. The permitted shape is custody, never spending.

The platforms then decide how far that custody reaches. The authentication page for Claude Code stores the credential in the encrypted keychain on macOS. It scopes the `.credentials.json` relocation under `CLAUDE_CONFIG_DIR` to Linux and Windows only. A macOS machine shows one item, service `Claude Code-credentials`, with the operating-system user as the account attribute, and every config home shares it. Codex documents `cli_auth_credentials_store`, whose `file` mode keeps `auth.json` under `CODEX_HOME`. So config-home isolation is whole on Linux and Windows, whole for Codex once seeded into file mode, and holed on macOS for Claude Code.

The defect record around programs that hold someone else's credential is consistent and unkind. Rotated refresh tokens get restored stale. Concurrent refreshes invalidate a live session. A transient failure leaves a corrupted bundle. Every one of those reports involves a second program refreshing, editing, or racing the tool that owns the credential.

## Decision

**A subscription account is a directory recompose owns and the provider's tool fills.** Sign-in and renewal run inside the tool, launched with the config-home variable aimed at that account's directory. recompose stores identity in `accounts.json`, watches standing without reading token material, and switches accounts by moving one `active` link per provider.

**recompose never refreshes a credential, never spends one, and never edits a blob.** Only the tool writes what the tool owns.

**Custody follows the platform rather than one mechanism everywhere.** Claude Code on Linux and Windows, and Codex in seeded file mode, keep the credential inside the account's home, and recompose doesn't touch it. Claude Code on macOS has one keychain item per operating-system user. A switch there parks the resident blob whole under the outgoing account, then places the incoming account's blob.

**The order never varies: park before place, pointer last.** A switch that dies partway leaves a credential parked, and the pointer still naming the account it came from. The next switch reads that state and finishes it. Placing first would overwrite a blob that nothing had saved yet.

**No schema can hold a subscription credential reference.** The account row splits by kind, and only the credentialed kinds carry a `credentialRef` field at all. The prohibition is a parse error rather than a review note.

## Consequences

**Good**: only the tool ever refreshes a credential. A parked blob's refresh token sits unused, so the recorded rotation races can't occur. The file stores under `~/.claude` and `~/.codex` that a person already uses stay untouched, so installing recompose costs them nothing. The prohibition holds in main, in the renderer, and in every test that loads the document, because no schema gives the forbidden state a shape.

**Bad**: macOS custody writes one foreign keychain item, prompts the person for keychain access, and makes the machine-wide Claude Code login follow whichever account is active in recompose. That last one surprises people, and the interface has to say it out loud. Parked credentials rest in the operating-system keychain, which is a carve-out from the resting rule in Architecture Decision Record (ADR) 0016, recorded here rather than assumed. A parked login can pass its hard lifetime while parked, and nobody learns until the next switch places it again. recompose watches standing rather than storing it, so standing can lag the truth by one observation. A Codex row shows no address and no plan, because OpenAI keeps both inside the `id_token` rather than beside it. Reading them would mean decoding token material for a label, so the row names the tool instead. Two environment seams let a test run name a binary rather than redirect a path: one for the keychain command, one for the sign-in launcher. ADR 0031 accepted environment seams on the grounds that they grant no privilege, and naming an executable goes a step past that. The step holds for the same reason ADR 0031 gave: whoever sets the environment already controls the process. Both seams stay out of any packaged launch script.

## Alternatives

**Config-home isolation alone, one variable and nothing else.** Clean, and it works on Linux and Windows. Rejected because the documented macOS limit leaves one shared keychain item, so signing in a second account would overwrite the first with no warning. An isolation story with a hole in it on the flagship platform isn't an isolation story.

**Run the authorization flow inside recompose.** Rejected twice over. The flagship provider forbids it, and it would recreate the rotation split-brain for a credential recompose can't spend anyway. Building the forbidden thing badly is worse than not building it.

**Swap the whole credential store on every platform, one mechanism everywhere.** Uniform, and easier to reason about in the abstract. Rejected because it writes foreign stores on the platforms where the vendors document per-home isolation working correctly. That multiplies the custody surface to buy symmetry and nothing else.

**Spawn the tool as a hidden child and scrape its status output.** Rejected because the sign-in is interactive. A person has to see a browser open and a code come back. A terminal they can watch is the honest surface for work that needs them present, and a hidden child that stalls on a prompt is a hang with no explanation.
