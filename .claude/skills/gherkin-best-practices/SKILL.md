---
name: gherkin-best-practices
description: Rules for writing Gherkin .feature files in recompose. Mandatory together with playwright-best-practices when writing or reviewing any e2e test, .feature file, or step definition.
---

# Gherkin best practices

Distilled from Cucumber's [Writing better Gherkin](https://cucumber.io/docs/bdd/better-gherkin/), the [BRIEF principle](https://cucumber.io/blog/bdd/keep-your-scenarios-brief/), and the Cucumber [anti-patterns series](https://cucumber.io/blog/bdd/cucumber-antipatterns-part-one/).

## The contract

- A `.feature` file is the maintainer's approval artifact. It states agreed behavior in language a reader understands without seeing any code.
- Write the scenario before the automation. A scenario written after the code documents the code, not the agreement.
- The tdd-bdd invariant applies at this layer too: a `.feature` file changes if and only if the agreed behavior changes. Step definitions absorb every implementation change.

## BRIEF

Every scenario passes all six checks:

- **Business language**: words come from the product domain (gateway, provider, account, virtual model), never from the DOM, the toolchain, or test infrastructure.
- **Real data**: concrete values (`anthropic`, `api-key`), not vague placeholders ("some provider", "valid input").
- **Intention revealing**: state what the actor achieves, not the mechanics used to achieve it.
- **Essential**: delete any line whose removal loses no meaning. Incidental detail hides the rule the scenario illustrates.
- **Focused**: one scenario illustrates one rule.
- **Brief**: three to five steps. A longer scenario is smuggling setup that belongs in `Background` or inside a step definition.

## Declarative, never imperative

- Describe what, not how. "When the maintainer connects an Anthropic account" beats four steps of navigating, typing, and clicking.
- Selectors, URLs, keystrokes, and button coordinates never appear in a step. They live in step definitions and page objects, governed by the playwright-best-practices skill.
- Don't over-abstract either. "Given the app works, then it works" states no behavior. Keep at least one concrete, checkable value per scenario.

## Structure rules

- One When-Then pair per scenario. A second When-Then is a second scenario.
- Scenarios run in any order with the same result. A scenario that depends on another scenario's leftovers is a defect.
- `Background` holds only context that every scenario in the file needs. Setup for one scenario stays in that scenario's Given.
- `Scenario Outline` earns its place only when the same rule holds across a table of real value combinations. Never use it to disguise unrelated cases as one rule.
- Tags classify, never configure: use them for suite selection (`@smoke`) and quarantine (`@quarantine`), not to smuggle parameters into steps.

## File and folder placement

- **One folder per capability, named after the spec it proves.** `openspec/specs/settings/` pairs with `gherkin/settings/` and with `apps/desktop/e2e/features/settings/`. The folder name is never invented; it comes from the capability.
- **The filename names the behavior area and never repeats the folder.** `settings/screen.feature`, not `settings/settings-screen.feature`. The path already said settings once.
- **One file per behavior area.** Not one file per requirement, which scatters a single rule, and not one file per capability, which grows past reading. A file you scroll to find a scenario in is two files.
- **Scenarios start in the change directory and graduate unchanged.** They're written to `openspec/changes/<slug>/gherkin/<capability>/` and land at `apps/desktop/e2e/features/<capability>/`. Graduation copies a directory. It never renames, re-sorts, or re-decides placement, because the placement decision was made once, at writing time.
- **The nesting needs no configuration.** The change schema generates `gherkin/**/*.feature` and the Playwright config reads `features/**/*.feature`, so a new capability folder is picked up on sight.

## Review test

Read the finished scenario as someone who has never seen the implementation. If any step needs the code to make sense, rewrite that step in domain language before committing.
