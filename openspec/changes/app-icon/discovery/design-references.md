# Design references: the session's Mobbin pass

Mobbin covers iOS and web screens, not desktop docks or menu bars, so the pass reads brand-mark behavior from the closest contexts: splash screens where the mark stands alone, and alternate-icon pickers where one mark survives across many tile treatments.

## A single glyph carries the brand at small sizes

Music and audio apps reduce the brand to one chunky, filled glyph the moment the context shrinks or goes monochrome. This supports the note-only tray icon and warns against carrying the frame into small contexts.

- [Shazam splash](https://mobbin.com/screens/effa361f-350f-4b30-bb58-2584c6ffb032): the S-wave glyph alone in a white circle on the brand gradient.
- [Spotify splash](https://mobbin.com/screens/259aa2ac-78f1-49be-a3fc-91851f61dbbd): three filled arcs in a filled disc, readable at any size.
- [SoundCloud landing](https://mobbin.com/screens/c76481f6-0b50-4acd-9a24-aae126388f5d): the cloud glyph renders in pure white over art and stays legible.
- [Wispr Flow splash](https://mobbin.com/screens/2c0a3028-3997-488b-8bcd-2fe78590228a): five filled bars, a glyph that is nothing but weight.

Every one of these glyphs is heavier than the note stem in the supplied recompose mark. The small-size variants need a thickened note.

## One glyph, many tiles: the variant discipline

Alternate-icon pickers show the discipline the Icon Composer appearances (default, dark, mono) formalize: the glyph never changes, only the tile behind it.

- [Discord's icon picker](https://mobbin.com/screens/16f267b4-1bd2-455a-8f50-d04934fcfa20): nine tiles, one unchanged glyph, including a near-mono Charcoal and Ceramic pair.
- [Phantom's icon picker](https://mobbin.com/screens/28542ec4-bbb8-40ed-9d5a-63d44dac211b): an explicit Light and Dark pair of the same mark, the exact shape of the Icon Composer default and dark appearances.
- [Monzo's icon gallery](https://mobbin.com/screens/1158c616-3f7c-478d-9dae-886d564cfa01) and [Runna's picker](https://mobbin.com/screens/13493a5d-9ad5-4239-b4c1-ec15bcfb51b1): the glyph holds its silhouette against light, dark, and photographic tiles.
- [Shopify's seasonal icons](https://mobbin.com/screens/2c0a84dd-ce5b-4c6d-ac71-1a27f8ff2cad): the bag silhouette persists while palette and texture rotate.

## What this feeds downstream

- The tray icon ships as the note glyph alone, filled and weighted, with no frame and no background tile.
- The Icon Composer dark and mono appearances keep the note geometry identical and vary only the tile, matching the picker discipline above.
- The 16 and 24 pixel Windows variants get a thickened note rather than a scaled-down master.

The maintainer's master mark for this change sits beside this file as [mark.svg](mark.svg).
