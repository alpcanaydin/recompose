# Mobbin references

Run in the orchestrating session, because the Mobbin tools live there rather than in `researcher`.

## The connected-account row

The row shape our reference draws is the field's settled one, and two apps carry the expired case the same way we mean to.

- [folk](https://mobbin.com/screens/502fe34b-4f83-442f-96fb-aded9dbd621a) draws a connected account as logo, address, a one-line detail, a green `Connected` pill, and an overflow at the trailing edge. That is our row, minus the plan badge.
- [Coda](https://mobbin.com/screens/8c9b4a22-2d88-4a27-b78c-51892a141f97) puts `Sign in again` on the row itself for an account that lost its authorisation, beside `Remove this account`. It confirms the reference's choice to keep Reconnect on the row rather than in a banner over the list.
- [Lindy](https://mobbin.com/screens/4ee806e8-6dc8-4456-9713-8a91c0977f65) reports status as a coloured dot and a word rather than a coloured word alone.
- [LangChain](https://mobbin.com/screens/c3ee2df7-4268-4daa-a45d-194770781ec6) carries a third row state, `Missing scopes`, in amber. A connection can be live and still incomplete, which is a state our two-way running-or-expired split has no room for.

## The catalog

Every reference reaches for the same content and disagrees about the container.

- [ElevenLabs](https://mobbin.com/screens/43120773-5432-4737-a66a-dfd38079d5a4) opens `Add integration` as a modal with a category rail down its left side and a search field at its top right.
- [LangChain](https://mobbin.com/screens/c3ee2df7-4268-4daa-a45d-194770781ec6) uses a category rail beside grouped headings, and each row carries a logo, a name, a one-line description, and either a `Connected` pill or a `Connect` button.
- [Claude](https://mobbin.com/screens/943f2beb-fa59-439a-b721-b69e5580807b) opens a directory modal with a left rail, a search field, and a filter chip above the results.
- [StackAI](https://mobbin.com/screens/de5d8a22-8fe3-4e03-8d72-a617015827fc) drops the categories entirely and leans on search over a flat grid.
- [Base44](https://mobbin.com/screens/53905efe-ddc0-4c0f-bcbc-2f4bc9fd46da) puts `Connected (2)` above `Available (39)` on one surface, so adding never leaves the list it adds to.

**The divergence worth taking to the brainstorm.** Four of the five reach for a modal with a category rail. Our reference reaches for a right drawer with category chips under the search, and says why: the drawer matches the inspector, and the chips arrived because the catalog outgrew one screenful. Both shapes are defensible and the field does not settle it, so the decision belongs to the brainstorm rather than to a majority count.

## What none of them do

No reference offers a fork between signing in and pasting a key. They connect one way per provider. Our reference draws both for Claude and labels them `Fewer steps` and `More flexible`, which is the Claude Code pattern rather than an integrations-screen pattern. Nothing here says whether a person reads that fork as a choice or as a question they lack the information to answer.
