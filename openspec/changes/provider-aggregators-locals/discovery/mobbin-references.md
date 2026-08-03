# Mobbin references

Run in the orchestrating session, because the Mobbin tools live there rather than in `researcher`.

## The aggregator in a provider catalog

The field treats an aggregator as one more key row, exactly as our spec delta does.

- [Adaline](https://mobbin.com/screens/46113df2-db45-4deb-b260-0b0e565ebe45) lists Open Router between Google and Together AI in one flat Providers table; a configured provider expands to a named configuration row with a one-line description and a delete act. No reference gives an aggregator a distinct anatomy.
- [Vercel](https://mobbin.com/screens/6cf10946-059f-4b49-b0b6-392d4b8e9863) titles its gateway key screen "Bring Your Own Key (BYOK)" and renders a flat vendor list where every row carries only a logo, a name, and `Add`. The catalog is the connect surface, which matches our grid-then-connect flow.
- [Braintrust](https://mobbin.com/screens/e4d603f8-78bc-439b-ad77-721850970ead) carries a `Status` column per provider row that reads `Not configured` or `✓ Configured` with a `just now` recency stamp. Together.ai sits in the same list as the direct vendors. The recency stamp is the closest thing any reference shows to a verify act on an aggregator, and it stamps the write, not a probe.

None of the three offers a check on an aggregator row. The verify absence our spec requires is what the field already ships.

## The detected local server

No reference draws an Ollama connect surface, so the observation pattern comes from adjacent local-agent and self-hosted rows.

- [Rox](https://mobbin.com/screens/9a1867ab-81aa-4983-82a6-b0f988bd3ed6) runs detection as its own step before the add: a single row reads the provider name beside a green `Available` pill, and `Continue` stays below the reading. Detect first, then decide, which is the order our local-runtimes delta requires.
- [Twingate](https://mobbin.com/screens/63275f9d-787b-482d-b12b-e233f3370988) draws a connector as name over address facts (hostname, private IP), with a green dot beside the word `Connected` and the component version under it. Status reads as a dot plus a word, never a coloured word alone, agreeing with the subscriptions reference from Lindy.
- [n8n](https://mobbin.com/screens/e0e39c98-8def-4f52-bc41-faaae38c3157) reports a workspace as `Currently online` with a green dot and `Running version n8n@1.113.3` beneath. A liveness reading paired with a version string is exactly what Ollama's version endpoint hands us for the row's observation line.

## What none of them do

No reference distinguishes "the server refused" from "the server timed out" on the surface; every one folds unreachable states into a single grey or red word. And no reference re-reads liveness on a schedule visible to the person: the reading happens on open or on demand. That supports the delta's rule that the standing is an observation as of the reading, never a stored claim.
