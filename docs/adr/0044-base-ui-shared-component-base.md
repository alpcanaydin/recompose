# 0044: Base UI as the base of the shared kit

**Status**: Accepted
**Date**: 2026-07-29

## Context

The settings screen needs a switch, a segmented control, a numeric field, and a grouped row. The renderer owned none of them. Before this change `apps/desktop/src/renderer/src/shared/` held an `api` segment and a `testing` segment, and the one field primitive in the repository sat inside a single page at `apps/desktop/src/renderer/src/pages/providers/ui/text-field.tsx`.

Four primitives on their own wouldn't earn an outside dependency. The screens after this one do, because every later screen inherits whatever this kit rests on. That reasoning overrides the You Aren't Gonna Need It objection, and the maintainer settled it in the proposal's locked decisions.

The number field decided the comparison. Every candidate ships a switch and a radio group, so the port field is the only place the four diverge:

| Library                    | Version | Number field                    | Label and description wiring |
| -------------------------- | ------- | ------------------------------- | ---------------------------- |
| Base UI (`@base-ui/react`) | 1.6.0   | yes                             | `Field` plus `Fieldset`      |
| Radix (`radix-ui`)         | 1.6.7   | none, the docs page returns 404 | `Label` alone                |
| React Aria Components      | 1.19.0  | yes                             | `Label` and `Text` slots     |
| Ark UI (`@ark-ui/react`)   | 5.37.2  | yes                             | `Field`                      |

Base UI reached 1.0.0 on 2025-12-11, and its peer range `^17 || ^18 || ^19` covers the React 19.2.8 this repository runs.

One question stayed open through the design phase. Base UI's number field documents `aria-roledescription="Number field"` and never names the role underneath it, so nobody could tell whether the control satisfies the spinbutton pattern.

## Decision

`@base-ui/react` 1.6.0 becomes the base of `apps/desktop/src/renderer/src/shared/ui/`. Six controls leave through one public interface. The switch, the segmented control, the numeric field, and the field row arrive new. The text field moves in from the providers page, and the field group stacks rows into a card.

Base UI's `Field.Root`, `Field.Label`, `Field.Control`, and `Field.Description` carry the grouped row, so the label association and the description reference come with the primitive rather than from hand-written attributes. Base UI also names which of its components inject inline styles and ships a nonce provider, and none of the six controls appear on that list. The Content Security Policy baseline in Architecture Decision Record (ADR) 0028 survives untouched.

### The segmented control builds on a radio group

One of three mutually exclusive values is a radio group, so `segmented-control.tsx` composes `RadioGroup` with one `Radio.Root` per option and leaves the segmented look to styling. The authoring practices for the radio pattern give the group a single tab stop, and the arrow keys move focus and change the selection in the same keystroke. A toggle group gives every segment its own tab stop and exposes pressed buttons rather than checked radios.

Primer's design system advises against the radio group role for a segmented control, on the grounds that a radio group implies a form with a save button. That reads as a convention claim rather than a normative one, and the convention doesn't apply here. The settings screen commits every change the moment it happens, so no save button exists for the role to imply.

### The number field lost to its own measurement

The story for `NumericField` closed the open question. The probe reported `{"spinbuttons":0,"textboxes":1,"role":null,"valuenow":null}`: Base UI's number field renders a textbox, carries no explicit role, and publishes neither a current value nor bounds. A screen reader hears no minimum, no maximum, and no value from the control itself.

`numeric-field.tsx` therefore falls back to a plain text input with `inputMode="numeric"`, and it states its accepted range in a `Field.Description` that `aria-describedby` points at. The description arrives as a prop rather than as a hard-coded string. `ENGINE_PORT_RANGE` in `packages/contracts/src/settings.ts` holds the bound the schema checks, so the row that carries the port renders one number and the copy can't drift.

The fallback costs less than it sounds. The United Kingdom government design system moved public forms off `type="number"` after user research. It landed on a text input with a numeric input mode, which is the shape this control now has. `numeric-field.stories.tsx` keeps the probe as a standing assertion. A Base UI release that starts exposing a spinbutton breaks that story rather than changing the control in silence.

## Alternatives

- **Radix.** Rejected because it ships no number field at all. The documentation page for one returns 404 and the component navigation lists none, which makes the hardest primitive of the four a hand-written spinbutton. The measurement above softens the verdict without reversing it: this kit hand-writes the field anyway, but as a text input, which is a far smaller thing to get right than a spinbutton.
- **React Aria Components.** Rejected on weight this project can't spend. Its number field carries locale numbering systems and `Intl.NumberFormat` output, which one Chromium target running one locale never exercises. Its style contract also fits the two-tier token system of ADR-0009 less well than data attributes and a render prop.
- **Ark UI.** Rejected for the same reason in a different shape. Its state-machine layer exists to keep several frameworks in step, and this renderer runs React alone. Multi-framework parity is surface with no consumer here.
- **Hand-writing all four primitives.** Rejected because the count only grows. One base carries the switch role, the radio roles, the label association, and the description reference for every control that follows, and four bespoke implementations carry none of it forward.
- **Base UI's own number field.** Rejected by the probe above, which closes the question the design phase left open rather than reversing it.
- **A toggle group for the segmented control.** Rejected because it exposes pressed buttons under a plain group, and it costs the person a tab stop for every segment.

## Consequences

- The renderer gains its first outside component dependency, and `apps/desktop/src/renderer/src/shared/ui/index.ts` becomes the place later screens shop from.
- `text-field.tsx` left the providers page for the kit, so the repository holds one input language rather than two. The account kind field kept its native select, which preserves the combobox role the acceptance run drives.
- The numeric field owns its draft-and-commit rules rather than inheriting them. Blur and Enter commit, Escape reverts, and a value outside the range keeps the stored one.
- The port range reaches a screen reader as description text rather than as `aria-valuemin` and `aria-valuemax`. That trade bought a control the assistive stack reads without surprises, and the range still reaches the reader.
- Every control carries a story, and the accessibility addon runs those stories in the `storybook` vitest project. The kit's roles stay measured rather than assumed.
