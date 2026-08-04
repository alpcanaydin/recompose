# 0074: Brand marks come from Lobe Icons, drawn as nominative use

**Status**: Accepted
**Date**: 2026-08-04

## Context

The mark set holds hand-vectored Anthropic and OpenAI paths and a boxed-letter monogram for OpenRouter, and every awaited row carries a generic glyph. The providers change grows the catalog to more than twenty named vendors across four destinations, and a wall of monograms and glyphs stops reading. The mark-name type is also welded to the connectable-provider identity, which breaks the moment a Soon card carries a mark.

## Decision

**The marks come from `@lobehub/icons`.** The package ships tree-shakable React components under the `MIT` license, with mono and color variants, purpose-built to cover AI vendors. The rule is a vendor draws its real mark and a category draws the shared network glyph. The inventory covers Anthropic, OpenAI, OpenRouter, Ollama, Together AI, Fireworks AI, Groq, DeepInfra, Cerebras, LM Studio, and vLLM. It also covers Gemini, Mistral, xAI Grok, DeepSeek, Moonshot AI, Qwen, GitHub Copilot, Kimi, `GLM`, and MiniMax. llama.cpp publishes no mark, so it keeps a server glyph, the one named miss in the inventory. The three Custom entries are categories and keep the network glyph as the rule.

**Affordance rides the variant.** A connectable card draws the color variant. A Soon card draws the mono variant on tertiary ink at full opacity, and no subtree dims by opacity, so the Soon badge reads at full strength. The monogram retires, and the mark-name type decouples from the connectable-provider identity type.

**The trademark stance rides with the dependency.** The `MIT` license covers the code, not the marks. Each logo remains its vendor's trademark, and recompose draws it solely to identify that vendor's own service a person connects to, which is nominative use. No mark implies endorsement, and a vendor's objection swaps its mark back to a glyph.

## Consequences

**Good**: every destination reads by shape before words, one dependency replaces hand-kept vectors, and the vendor-or-category rule decides future entries on its own.

**Bad**: every visual baseline that shows a mark changes in one release, and regeneration runs through the `update-baselines` label on CI, never locally. The icon set now updates on the package's cadence through Renovate. The design carries the trademark risk in the open rather than avoiding it, and the llama.cpp asymmetry stands until that project publishes a mark.

**The peer tree needs a fence.** The package names `@lobehub/ui` as a peer, and pnpm would install close to four hundred packages behind it, several with licenses the gate refuses. `pnpm-workspace.yaml` marks that peer optional under `packageExtensions`, which holds the production tree near one hundred twenty packages, none of them bundled. The renderer imports each vendor's leaf `Mono` and `Color` components directly, because the package publishes no exports map and its barrel pulls the whole interface library. Ten marks publish no color component because those brands are monochrome by design, and the inventory names them rather than probing at runtime.

## Alternatives

**Keeping monograms and glyphs.** Rejected: twenty look-alike squares defeat the recognition a catalog exists for.

**Hand-vectoring each mark.** Rejected: it carries the same trademark posture with none of the coverage, and every vendor rebrand becomes local maintenance.

**`simple-icons`.** Rejected: it lacks the AI-vendor coverage and the paired mono and color variants this catalog needs.

**Fetching logos from a metadata catalog.** Rejected: the research brief already marks that dependency wrong for an offline-first app.
