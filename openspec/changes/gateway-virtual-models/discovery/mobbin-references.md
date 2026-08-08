# Mobbin references

Run in the orchestrating session, because the Mobbin tools live there rather than in `researcher`.

## The named model bound to a real one

- [Twenty](https://mobbin.com/screens/ecb8c8e1-26f5-431e-9360-8839dbf6d48e) is the closest single reference to the slice: a settings row names a role ("Fast Model", with a one-line purpose under it) and binds it to a picked real model through a compact picker at the trailing edge. Beneath it, the available models list carries a provider column beside every model name and a search field over the set. A named alias bound to one real model is exactly the virtual-model shape, and the field ships it as a row plus a picker, not a diagram.
- [Gamma](https://mobbin.com/screens/7b5c17bb-6f64-4e5a-ab1a-88b5a2571e32) groups its picker into Recommended and Basic models with an Auto-select default at the top. The grouping carries the judgement; the list stays flat inside each group.

## The model picker

Every reference groups or prefixes by provider, and search appears as soon as the list outgrows a screenful.

- [Braintrust](https://mobbin.com/screens/cc674d0c-9a3d-439d-9cdf-414fb1ae4c67) opens "Find a model" over a cascading menu: provider first, then the model, then a variations submenu for dated snapshots. The cascade keeps long catalogs navigable without a table.
- [Cloudflare](https://mobbin.com/screens/2b0d9a61-bffb-4049-b88a-158b212881ad) prefixes every entry with its provider slug in a searchable flat list, and shows the picked model's card (id, pricing) beside the picker.
- [Google AI Studio](https://mobbin.com/screens/7fd4e4c8-3e16-44ab-8897-17c84a9d857c) adds filter chips over the search and a detail card per model (pricing, knowledge cutoff). Rich metadata arrives at pick time, not in the list.

## The gateway as a form, not a canvas

- [Cloudflare](https://mobbin.com/screens/b449f928-6d39-4c89-a978-a7f481a4d0cd) configures an AI gateway as a plain settings form: name, logging, caching, rate limits, each a labeled row. No reference draws a node canvas for configuration at this scale.
- [Braintrust](https://mobbin.com/screens/43f95457-c22f-4cbe-b093-8f3aee10adec) and [Adaline](https://mobbin.com/screens/46113df2-db45-4deb-b260-0b0e565ebe45) both treat provider credentials and model access as list-and-form surfaces.

## What none of them do

No reference maps one alias to one model through a canvas or a graph; the one-to-one binding is always a row with a picker, which supports the slice's no-canvas decision. And no reference lets the alias's target be a credential the person hasn't stored yet: every picker draws from already-connected providers, which matches the slice's stored-accounts-only rule.
